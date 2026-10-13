import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {createApi} from '../api/createApi';
import {errorMessage, type ClientErrorCode} from '../api/errors';
import type {ActiveBooking, Resource, Slot} from '../api/types';
import {sv} from '../i18n/sv';
import {formatWhen, timeRange} from '../lib/dates';
import type {Dialog, DialogAction} from '../lib/dialog';
import {bookingActions} from './bookingActions';

const t = sv;
const DATE = '2030-01-15';
const SAUNA: Resource = {id: 'sauna', name: 'Bastu', kind: 'sauna', tags: []};
const WHEN = `Bastu, ${formatWhen(DATE, timeRange('17:00', '19:00'), t)}`;
const TIMES = {date: DATE, start: '17:00', end: '19:00'};

type Shown =
  | {kind: 'alert'; title: string; message: string}
  | {kind: 'confirm'; title: string; message: string; action: DialogAction};

type Sent = {method: string; path: string; body: unknown};

// What the fake server answers the next request with.
let answer: {status: number; code?: string} = {status: 200};
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
      : Response.json({}, {status: answer.status});
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
  };
  const onChange = vi.fn();
  const {api, unwrap} = createApi({
    baseUrl: 'http://localhost',
    credentials: 'omit',
    headers: () => ({}),
    onUnauthorized: () => {},
  });
  const actions = bookingActions({api, unwrap, dialog, t, onChange});

  // Presses the action of the one confirmation shown so far and waits
  // until the request it sends has been answered and handled.
  async function press() {
    const [first] = shown;
    if (first?.kind !== 'confirm') {
      throw new Error('No confirmation shown');
    }

    first.action.onPress();
    await vi.waitFor(() => {
      expect(onChange.mock.calls.length + shown.length).toBeGreaterThan(1);
    });
  }

  return {actions, shown, onChange, press};
}

const available: Slot = {...TIMES, status: 'available', subscriptionId: null};
const booked: Slot = {
  ...TIMES,
  status: 'booked',
  started: false,
  subscriptionId: null,
};
const queued: Slot = {...booked, subscriptionId: 'sub-1'};
const mine: Slot = {...TIMES, status: 'mine', bookingId: 'b-1', started: false};
const running: Slot = {...mine, started: true};

describe('confirmBook asks first', () => {
  test('booking a free time', async () => {
    const {actions, shown, onChange, press} = setup();

    actions.confirmBook(available, SAUNA, null);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.booking.bookTitle,
        message: t.booking.bookQuestion(WHEN),
        action: {label: t.times.book, onPress: expect.any(Function)},
      },
    ]);

    await press();
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/bookings',
        body: {date: DATE, start: '17:00', resourceId: 'sauna'},
      },
    ]);
    expect(onChange).toHaveBeenCalledOnce();
    expect(shown).toHaveLength(1);
  });

  test('swapping for the booking held', async () => {
    const {actions, shown, onChange, press} = setup();
    const active: ActiveBooking = {released: false};

    actions.confirmBook(available, SAUNA, active);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.booking.alreadyBookedTitle,
        message: t.booking.swapQuestion(WHEN),
        action: {label: t.booking.swap, onPress: expect.any(Function)},
      },
    ]);

    await press();
    expect(sent[0]?.body).toEqual({
      date: DATE,
      start: '17:00',
      resourceId: 'sauna',
      replaceExisting: true,
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('a released booking blocks a new one', () => {
    const {actions, shown, onChange} = setup();

    actions.confirmBook(available, SAUNA, {released: true});

    expect(shown).toEqual([
      {
        kind: 'alert',
        title: t.booking.alreadyBookedTitle,
        message: t.booking.releasedBlocks,
      },
    ]);
    expect(sent).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('queueing for a taken time', async () => {
    const {actions, shown, onChange, press} = setup();

    actions.confirmBook(booked, SAUNA, null);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.booking.queueTitle,
        message: t.booking.queueQuestion(WHEN),
        action: {label: t.booking.queueMe, onPress: expect.any(Function)},
      },
    ]);

    await press();
    expect(sent).toEqual([
      {
        method: 'POST',
        path: '/subscriptions',
        body: {date: DATE, start: '17:00', resourceId: 'sauna'},
      },
    ]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('leaving the queue', async () => {
    const {actions, shown, onChange, press} = setup();

    actions.confirmBook(queued, SAUNA, null);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.times.leaveQueue,
        message: t.booking.leaveQueueQuestion(WHEN),
        action: {
          label: t.times.leaveQueue,
          destructive: true,
          onPress: expect.any(Function),
        },
      },
    ]);

    await press();
    expect(sent).toEqual([
      {method: 'DELETE', path: '/subscriptions/sub-1', body: null},
    ]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('cancelling a booking', async () => {
    const {actions, shown, onChange, press} = setup();

    actions.confirmBook(mine, SAUNA, null);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.booking.cancelTitle,
        message: t.booking.cancelQuestion(WHEN),
        action: {
          label: t.times.cancel,
          destructive: true,
          onPress: expect.any(Function),
        },
      },
    ]);

    await press();
    expect(sent).toEqual([
      {method: 'DELETE', path: '/bookings/b-1', body: null},
    ]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('releasing a booking that has started', async () => {
    const {actions, shown, onChange, press} = setup();

    actions.confirmBook(running, SAUNA, null);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.booking.releaseTitle,
        message: t.booking.releaseQuestion(WHEN),
        action: {label: t.times.done, onPress: expect.any(Function)},
      },
    ]);

    await press();
    expect(sent).toEqual([
      {method: 'DELETE', path: '/bookings/b-1', body: null},
    ]);
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('times that cannot be acted on show nothing', () => {
    const {actions, shown} = setup();

    actions.confirmBook({...TIMES, status: 'walkin'}, SAUNA, null);
    actions.confirmBook({...booked, started: true}, SAUNA, null);

    expect(shown).toEqual([]);
  });
});

describe('a failure is told', () => {
  const failures: [string, Slot, string][] = [
    ['booking', available, t.booking.bookFailed],
    ['queueing', booked, t.booking.queueFailed],
    ['leaving the queue', queued, t.booking.leaveQueueFailed],
    ['cancelling', mine, t.booking.cancelFailed],
    ['releasing', running, t.booking.releaseFailed],
  ];

  test.each(failures)('%s', async (_, slot, title) => {
    const {actions, shown, onChange, press} = setup();
    answer = {status: 500, code: 'SERVER_ERROR'};

    actions.confirmBook(slot, SAUNA, null);
    await press();

    expect(shown[1]).toEqual({
      kind: 'alert',
      title,
      message: errorMessage('SERVER_ERROR', t),
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  // NOT_FOUND among them: a time someone else already freed, or a change
  // that went through although its answer never arrived.
  const reloading: [ClientErrorCode, number][] = [
    ['SLOT_TAKEN', 409],
    ['SLOT_STARTED', 409],
    ['SLOT_AVAILABLE', 409],
    ['HAS_ACTIVE_BOOKING', 409],
    ['NOT_FOUND', 404],
  ];

  test.each(reloading)('%s reloads the times', async (code, status) => {
    const {actions, shown, onChange, press} = setup();
    answer = {status, code};

    actions.confirmBook(available, SAUNA, null);
    await press();

    expect(onChange).toHaveBeenCalledOnce();
    expect(shown[1]).toEqual({
      kind: 'alert',
      title: t.booking.bookFailed,
      message: errorMessage(code, t),
    });
  });

  const undoing: [string, Slot][] = [
    ['leaving the queue', queued],
    ['cancelling', mine],
    ['releasing', running],
  ];

  test.each(undoing)('%s what is already gone is done', async (_, slot) => {
    const {actions, shown, onChange, press} = setup();
    answer = {status: 404, code: 'NOT_FOUND'};

    actions.confirmBook(slot, SAUNA, null);
    await press();

    expect(onChange).toHaveBeenCalledOnce();
    expect(shown).toHaveLength(1);
  });

  const other: [ClientErrorCode, number][] = [
    ['SLOT_IN_PAST', 409],
    ['OUTSIDE_BOOKING_WINDOW', 409],
    ['SERVER_ERROR', 500],
  ];

  test.each(other)('%s leaves the times', async (code, status) => {
    const {actions, shown, onChange, press} = setup();
    answer = {status, code};

    actions.confirmBook(available, SAUNA, null);
    await press();

    expect(onChange).not.toHaveBeenCalled();
    expect(shown[1]).toEqual({
      kind: 'alert',
      title: t.booking.bookFailed,
      message: errorMessage(code, t),
    });
  });
});
