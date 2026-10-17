import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {createApi} from '../api/createApi';
import {errorMessage, type ClientErrorCode} from '../api/errors';
import type {Held, HeldBooking, Resource, Slot} from '../api/types';
import {sv} from '../i18n/sv';
import {formatWhen, unbrokenRange} from '../lib/dates';
import type {
  Dialog,
  DialogAction,
  DialogChoice,
  DialogTime,
} from '../lib/dialog';
import {bookingActions} from './bookingActions';
import {slotOffer} from './offer';

const t = sv;
const DATE = '2030-01-15';
const SAUNA: Resource = {
  id: 'sauna',
  name: 'Bastu',
  kind: 'sauna',
  tags: [],
  closed: false,
  closingNote: '',
};
const WHEN = `Bastu, ${formatWhen(DATE, unbrokenRange('17:00', '19:00'), t)}`;
const TIMES = {date: DATE, start: '17:00', end: '19:00'};

type Shown =
  | {kind: 'alert'; title: string; message: string}
  | {
      kind: 'confirm';
      title: string;
      message: string;
      action: DialogAction;
      times?: DialogTime[];
    }
  | {
      kind: 'choose';
      title: string;
      message: string;
      choices: DialogChoice[];
      options?: {times?: DialogTime[]; choicesLabel?: string};
    };

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
    confirm: (title, message, action, times) =>
      shown.push({
        kind: 'confirm',
        title,
        message,
        action,
        ...(times ? {times} : {}),
      }),
    choose: (title, message, choices, options) =>
      shown.push({
        kind: 'choose',
        title,
        message,
        choices,
        ...(options ? {options} : {}),
      }),
  };
  const onChange = vi.fn();
  const {api, unwrap} = createApi({
    baseUrl: 'http://localhost',
    credentials: 'omit',
    headers: () => ({}),
    onUnauthorized: () => {},
  });
  const actions = bookingActions({api, unwrap, dialog, t, onChange});

  // Presses a time in the day view, the way the clients do.
  function pick(slot: Slot, held: Held = NOTHING_HELD) {
    const {action} = slotOffer(slot, SAUNA, held, t);
    if (action) {
      actions.confirm(action);
    }
  }

  // Presses the action of the one confirmation shown so far and waits
  // until the request it sends has been answered and handled.
  async function press(choice = 0) {
    const [first] = shown;
    if (first?.kind !== 'confirm' && first?.kind !== 'choose') {
      throw new Error('No confirmation shown');
    }

    const pressed =
      first?.kind === 'choose' ? first.choices[choice] : first?.action;
    pressed?.onPress();
    await vi.waitFor(() => {
      expect(onChange.mock.calls.length + shown.length).toBeGreaterThan(1);
    });
  }

  return {pick, shown, onChange, press};
}

const NOTHING_HELD: Held = {max: 1, bookings: []};

function heldBooking(id: string, start: string, end: string): HeldBooking {
  return {
    id,
    date: DATE,
    start,
    end,
    resourceName: 'Bastu',
    started: false,
    released: false,
  };
}

const MORNING = heldBooking('held-1', '07:00', '09:00');
const NOON = heldBooking('held-2', '12:00', '14:00');

function whenOf({start, end}: HeldBooking) {
  return `Bastu, ${formatWhen(DATE, unbrokenRange(start, end), t)}`;
}

function cardOf(
  {start, end}: {start: string; end: string},
  label?: {caption: string; tone: 'old' | 'new'},
) {
  return {
    ...label,
    resource: 'Bastu',
    when: formatWhen(DATE, unbrokenRange(start, end), t),
  };
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

describe('pressing a time asks first', () => {
  test('booking a free time', async () => {
    const {pick, shown, onChange, press} = setup();

    pick(available);

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

  test('at the cap of one, swapping for the booking held', async () => {
    const {pick, shown, onChange, press} = setup();

    pick(available, {max: 1, bookings: [MORNING]});

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.booking.alreadyHolding(1),
        message: t.booking.swapQuestion,
        action: {label: t.booking.swap, onPress: expect.any(Function)},
        times: [
          cardOf(MORNING, {caption: t.booking.swapFrom, tone: 'old'}),
          cardOf(TIMES, {caption: t.booking.swapTo, tone: 'new'}),
        ],
      },
    ]);

    await press();
    expect(sent[0]?.body).toEqual({
      date: DATE,
      start: '17:00',
      resourceId: 'sauna',
      replaceBookingId: 'held-1',
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('at the cap of two, choosing which booking to swap', async () => {
    const {pick, shown, onChange, press} = setup();

    pick(available, {max: 2, bookings: [MORNING, NOON]});

    expect(shown).toEqual([
      {
        kind: 'choose',
        title: t.booking.alreadyHolding(2),
        message: t.booking.chooseSwapQuestion,
        choices: [
          {
            label: whenOf(MORNING),
            time: cardOf(MORNING),
            onPress: expect.any(Function),
          },
          {
            label: whenOf(NOON),
            time: cardOf(NOON),
            onPress: expect.any(Function),
          },
        ],
        options: {
          times: [cardOf(TIMES, {caption: t.booking.swapTo, tone: 'new'})],
          choicesLabel: t.booking.swapChoices,
        },
      },
    ]);

    await press(1);
    expect(sent[0]?.body).toEqual({
      date: DATE,
      start: '17:00',
      resourceId: 'sauna',
      replaceBookingId: 'held-2',
    });
    expect(onChange).toHaveBeenCalledOnce();
  });

  test('under the cap, booking without a swap', () => {
    const {pick, shown} = setup();

    pick(available, {max: 2, bookings: [MORNING]});

    expect(shown[0]).toMatchObject({
      kind: 'confirm',
      title: t.booking.bookTitle,
    });
  });

  test('only a booking that has neither started nor been released is offered', () => {
    const {pick, shown} = setup();

    pick(available, {
      max: 2,
      bookings: [{...MORNING, started: true}, NOON],
    });

    expect(shown[0]).toMatchObject({
      kind: 'confirm',
      title: t.booking.alreadyHolding(2),
      message: t.booking.swapQuestion,
      times: [
        cardOf(NOON, {caption: t.booking.swapFrom, tone: 'old'}),
        cardOf(TIMES, {caption: t.booking.swapTo, tone: 'new'}),
      ],
    });
  });

  test('nothing to give up blocks a new booking', () => {
    const {pick, shown, onChange} = setup();

    pick(available, {
      max: 2,
      bookings: [
        {...MORNING, released: true},
        {...NOON, started: true},
      ],
    });

    expect(shown).toEqual([
      {
        kind: 'alert',
        title: t.booking.alreadyHolding(2),
        message: t.booking.fullUntilOver(2),
      },
    ]);
    expect(sent).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('queueing for a taken time', async () => {
    const {pick, shown, onChange, press} = setup();

    pick(booked);

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
    const {pick, shown, onChange, press} = setup();

    pick(queued);

    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: t.times.leaveQueue,
        message: t.booking.leaveQueueQuestion(WHEN),
        action: {
          label: t.times.leaveQueue,
          destructive: true,
          cancelLabel: t.booking.stayInQueue,
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
    const {pick, shown, onChange, press} = setup();

    pick(mine);

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
    const {pick, shown, onChange, press} = setup();

    pick(running);

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
    const {pick, shown} = setup();

    pick({...TIMES, status: 'walkin'});
    pick({...booked, started: true});

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
    const {pick, shown, onChange, press} = setup();
    answer = {status: 500, code: 'SERVER_ERROR'};

    pick(slot);
    await press();

    expect(shown[1]).toEqual({
      kind: 'alert',
      title,
      message: errorMessage('SERVER_ERROR', t),
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  // NOT_FOUND among them: a resource or time that is no longer there.
  const reloading: [ClientErrorCode, number][] = [
    ['SLOT_TAKEN', 409],
    ['SLOT_STARTED', 409],
    ['SLOT_AVAILABLE', 409],
    ['HAS_ACTIVE_BOOKING', 409],
    ['NOT_FOUND', 404],
  ];

  test.each(reloading)('%s reloads the times', async (code, status) => {
    const {pick, shown, onChange, press} = setup();
    answer = {status, code};

    pick(available);
    await press();

    expect(onChange).toHaveBeenCalledOnce();
    expect(shown[1]).toEqual({
      kind: 'alert',
      title: t.booking.bookFailed,
      message: errorMessage(code, t),
    });
  });

  const other: [ClientErrorCode, number][] = [
    ['SLOT_IN_PAST', 409],
    ['OUTSIDE_BOOKING_WINDOW', 409],
    ['SERVER_ERROR', 500],
  ];

  test.each(other)('%s leaves the times', async (code, status) => {
    const {pick, shown, onChange, press} = setup();
    answer = {status, code};

    pick(available);
    await press();

    expect(onChange).not.toHaveBeenCalled();
    expect(shown[1]).toEqual({
      kind: 'alert',
      title: t.booking.bookFailed,
      message: errorMessage(code, t),
    });
  });
});
