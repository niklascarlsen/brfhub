import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {createApi} from '../api/createApi';
import {errorMessage} from '../api/errors';
import type {AdminResource, Apartment} from '../api/types';
import {sv} from '../i18n/sv';
import {formatLongDate} from '../lib/dates';
import type {Dialog, DialogAction} from '../lib/dialog';
import {adminActions, adminLoads} from './actions';

const t = sv;

type Shown =
  | {kind: 'alert'; title: string; message: string}
  | {kind: 'confirm'; title: string; message: string; action: DialogAction};

type Sent = {method: string; path: string; body: unknown};

// What the fake server answers the next request with.
let answer: {status: number; code?: string; body?: unknown} = {status: 200};
let sent: Sent[] = [];

beforeEach(() => {
  answer = {status: 200};
  sent = [];

  vi.stubGlobal('fetch', async (request: Request) => {
    const text = await request.text();
    sent.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? JSON.parse(text) : null,
    });

    return answer.code
      ? Response.json({code: answer.code, message: ''}, {status: answer.status})
      : Response.json(answer.body ?? {}, {status: answer.status});
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const shown: Shown[] = [];
  const dialog: Dialog = {
    alert: (title, message) => shown.push({kind: 'alert', title, message}),
    confirm: (title, message, action) =>
      shown.push({kind: 'confirm', title, message, action}),
    choose: () => {
      throw new Error('The admin is never given a choice');
    },
  };
  const onChange = vi.fn();
  const onBusy = vi.fn();
  const client = createApi({
    baseUrl: 'http://localhost',
    credentials: 'omit',
    headers: () => ({}),
    onUnauthorized: () => {},
  });
  const actions = adminActions({...client, dialog, t, onChange, onBusy});

  // Presses the action of the one confirmation shown so far.
  function press() {
    const [first] = shown;
    if (first?.kind !== 'confirm') {
      throw new Error('No confirmation shown');
    }
    first.action.onPress();
  }

  // Waits until a request a button sent has been answered and handled.
  async function settled() {
    await vi.waitFor(() => {
      expect(onBusy).toHaveBeenLastCalledWith(false);
    });
  }

  return {actions, client, shown, onChange, onBusy, press, settled};
}

const APARTMENT: Apartment = {
  id: 'apartment-1',
  label: '12',
  residentName: 'Anna',
  email: '12@example.com',
  lastSignInOn: null,
  upcomingBookings: 2,
};

function resource(id: string, kindId: string): AdminResource {
  return {
    id,
    name: {sv: id},
    kindId,
    tags: {},
    closesFrom: null,
    schedules: [],
  };
}

describe('a button asks first, then sends', () => {
  test('removing an apartment says what goes with it', async () => {
    const {actions, shown, onChange, press, settled} = setup();
    const onRemoved = vi.fn();

    actions.apartments.confirmRemove(APARTMENT, onRemoved);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.admin.apartment.remove,
        message: t.admin.apartment.removeQuestion(
          t.admin.apartment.cancelNote(2),
        ),
        action: {
          label: t.admin.remove,
          destructive: true,
          onPress: expect.any(Function),
        },
      },
    ]);
    expect(sent).toEqual([]);

    press();
    await settled();

    expect(sent).toEqual([
      {method: 'DELETE', path: '/admin/apartments/apartment-1', body: null},
    ]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onRemoved).toHaveBeenCalledOnce();
    expect(shown).toHaveLength(1);
  });

  test('a new password is handed on once it is made', async () => {
    const {actions, shown, press, settled} = setup();
    const onPassword = vi.fn();
    answer = {status: 200, body: {password: 'abcd-efgh-jkmn'}};

    actions.apartments.confirmResetPassword(APARTMENT, onPassword);

    expect(shown[0]).toMatchObject({
      title: t.admin.apartment.resetPassword,
      message: t.admin.apartment.resetQuestion('12'),
      action: {label: t.admin.apartment.reset},
    });
    expect(shown[0]?.kind === 'confirm' && shown[0].action.destructive).toBe(
      undefined,
    );

    press();
    await settled();

    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/admin/apartments/apartment-1/reset-password',
        body: null,
      },
    ]);
    expect(onPassword).toHaveBeenCalledWith('abcd-efgh-jkmn');
  });

  test('removing a notice names it', async () => {
    const {actions, shown, press, settled} = setup();
    const onRemoved = vi.fn();

    actions.announcements.confirmRemove('notice-1', 'Städdag', onRemoved);

    expect(shown[0]).toMatchObject({
      title: t.admin.announcements.remove,
      message: t.admin.announcements.removeQuestion('Städdag'),
      action: {label: t.admin.remove, destructive: true},
    });

    press();
    await settled();

    expect(sent).toEqual([
      {method: 'DELETE', path: '/admin/announcements/notice-1', body: null},
    ]);
    expect(onRemoved).toHaveBeenCalledOnce();
  });

  test('closing a resource says from which day', async () => {
    const {actions, shown, onChange, press, settled} = setup();

    actions.resources.confirmClose('sauna', 'Bastu', '2030-02-01');

    expect(shown[0]).toMatchObject({
      title: t.admin.resource.close,
      message: t.admin.resource.closeQuestion(
        'Bastu',
        formatLongDate('2030-02-01', t),
      ),
      action: {label: t.admin.resource.closeAction, destructive: true},
    });

    press();
    await settled();

    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/admin/resources/sauna/closing',
        body: {closesFrom: '2030-02-01'},
      },
    ]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('removing a change of times says from which day', async () => {
    const {actions, shown, press, settled} = setup();

    actions.resources.confirmRemoveChange('sauna', '2030-02-01');

    expect(shown[0]).toMatchObject({
      title: t.admin.resource.removeChange,
      message: t.admin.resource.removeChangeQuestion(
        formatLongDate('2030-02-01', t),
      ),
      action: {label: t.admin.remove, destructive: true},
    });

    press();
    await settled();

    expect(sent).toEqual([
      {
        method: 'DELETE',
        path: '/admin/resources/sauna/schedule/2030-02-01',
        body: null,
      },
    ]);
  });
});

describe('a button that needs no question sends at once', () => {
  test('a kind no resource uses is removed', async () => {
    const {actions, shown, onChange, settled} = setup();
    const onRemoved = vi.fn();

    void actions.kinds.remove('laundry', onRemoved);
    await settled();

    expect(shown).toEqual([]);
    expect(sent).toEqual([
      {method: 'DELETE', path: '/admin/kinds/laundry', body: null},
    ]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(onRemoved).toHaveBeenCalledOnce();
  });

  test('a move swaps places with the next resource of the same kind', async () => {
    const {actions, settled} = setup();
    const all = [
      resource('laundry-1', 'laundry'),
      resource('sauna', 'sauna'),
      resource('laundry-2', 'laundry'),
    ];

    actions.resources.move(all, all[0]!, 1);
    await settled();

    expect(sent).toEqual([
      {
        method: 'PUT',
        path: '/admin/resources/order',
        body: {ids: ['laundry-2', 'sauna', 'laundry-1']},
      },
    ]);
  });

  test('a move past the end of its kind sends nothing', () => {
    const {actions, onBusy} = setup();
    const all = [resource('laundry-1', 'laundry'), resource('sauna', 'sauna')];

    actions.resources.move(all, all[0]!, 1);
    actions.resources.move(all, all[0]!, -1);

    expect(sent).toEqual([]);
    expect(onBusy).not.toHaveBeenCalled();
  });

  test('reopening tells apart a closed resource and a closing ahead', async () => {
    const {actions, shown, settled} = setup();
    answer = {status: 500, code: 'SERVER_ERROR'};

    void actions.resources.reopen('sauna', true);
    await settled();
    void actions.resources.reopen('sauna', false);
    await vi.waitFor(() => expect(shown).toHaveLength(2));

    expect(shown.map((item) => item.title)).toEqual([
      t.admin.resource.reopenFailed,
      t.admin.resource.undoCloseFailed,
    ]);
  });

  test('holds the buttons while the request is out', async () => {
    const {actions, onBusy, settled} = setup();

    void actions.kinds.remove('laundry', () => {
      expect(onBusy.mock.calls).toEqual([[true], [false]]);
    });
    expect(onBusy.mock.calls).toEqual([[true]]);
    await settled();
  });
});

describe('a failure is told', () => {
  test('in a dialog, and nothing follows it', async () => {
    const {actions, shown, onChange, press, settled} = setup();
    const onRemoved = vi.fn();
    answer = {status: 409, code: 'APARTMENT_TAKEN'};

    actions.apartments.confirmRemove(APARTMENT, onRemoved);
    press();
    await settled();

    expect(shown[1]).toEqual({
      kind: 'alert',
      title: t.admin.apartment.removeFailed,
      message: errorMessage('APARTMENT_TAKEN', t),
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
  });

  test.each(['NOT_FOUND', 'KIND_IN_USE', 'CHANGE_INSIDE_WINDOW'])(
    '%s reloads what is shown',
    async (code) => {
      const {actions, shown, onChange, settled} = setup();
      const onRemoved = vi.fn();
      answer = {status: 409, code};

      void actions.kinds.remove('laundry', onRemoved);
      await settled();

      expect(shown).toEqual([
        {
          kind: 'alert',
          title: t.admin.resources.removeKindFailed,
          message: t.errors[code as keyof typeof t.errors],
        },
      ]);
      expect(onChange).toHaveBeenCalledOnce();
      expect(onRemoved).not.toHaveBeenCalled();
    },
  );
});

describe('a form saves through the actions', () => {
  test('sends what the form gives and reports the change', async () => {
    const {actions, onChange} = setup();
    answer = {status: 200, body: {id: 'sauna'}};
    const fields = {
      name: {sv: 'Bastu'},
      kindId: 'sauna-kind',
      tags: {sv: ['Källaren']},
      slots: [{start: '08:00', end: '11:00', endOffsetDays: 0 as const}],
    };

    await expect(actions.resources.create(fields)).resolves.toEqual({
      id: 'sauna',
    });

    expect(sent).toEqual([
      {method: 'POST', path: '/admin/resources', body: fields},
    ]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('leaves a failure to the form, which shows it', async () => {
    const {actions, shown, onChange} = setup();
    answer = {status: 400, code: 'VALIDATION'};

    await expect(
      actions.organization.save({name: 'Brf Exempel'}),
    ).rejects.toMatchObject({code: 'VALIDATION'});

    expect(sent).toEqual([
      {
        method: 'PATCH',
        path: '/admin/organization',
        body: {name: 'Brf Exempel'},
      },
    ]);
    expect(shown).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('a new resident keeps the number', async () => {
    const {actions} = setup();

    await actions.apartments.newResident('apartment-1', {
      residentName: 'Bo',
      email: 'bo@example.com',
    });

    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/admin/apartments/apartment-1/new-resident',
        body: {residentName: 'Bo', email: 'bo@example.com'},
      },
    ]);
  });
});

test('the screens load what the admin manages', async () => {
  const {client} = setup();
  const load = adminLoads(client);

  await load.apartments();
  await load.announcements();
  await load.resources();
  await load.organization();

  expect(sent.map(({method, path}) => `${method} ${path}`)).toEqual([
    'GET /admin/apartments',
    'GET /admin/announcements',
    'GET /admin/resources',
    'GET /admin/organization',
  ]);
});
