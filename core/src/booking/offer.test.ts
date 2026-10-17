import {describe, expect, test} from 'vitest';

import type {
  Booking,
  Held,
  HeldBooking,
  Resource,
  Slot,
  Subscription,
} from '../api/types';
import {sv} from '../i18n/sv';
import {bookingCard, queueCard, slotOffer, takeAction} from './offer';

const t = sv;
const DATE = '2030-01-15';
const TIMES = {date: DATE, start: '17:00', end: '19:00'};
const SAUNA: Resource = {
  id: 'sauna',
  name: 'Bastu',
  kind: 'sauna',
  tags: [],
  closed: false,
  closingNote: '',
};
const TARGET = {...TIMES, resourceName: 'Bastu', resourceId: 'sauna'};
const NOTHING_HELD: Held = {max: 1, bookings: []};

const HELD: HeldBooking = {
  id: 'held-1',
  date: DATE,
  start: '07:00',
  end: '09:00',
  resourceName: 'Bastu',
  started: false,
  released: false,
};

describe('takeAction', () => {
  test('under the cap books', () => {
    expect(takeAction(TARGET, {max: 2, bookings: [HELD]})).toEqual({
      kind: 'book',
      target: TARGET,
    });
  });

  test('at the cap swaps one that can be given up', () => {
    const started = {...HELD, id: 'held-2', started: true};

    expect(takeAction(TARGET, {max: 2, bookings: [started, HELD]})).toEqual({
      kind: 'swap',
      target: TARGET,
      choices: [HELD],
      held: 2,
    });
  });

  test('at the cap with nothing to give up is full', () => {
    const released = {...HELD, released: true};

    expect(takeAction(TARGET, {max: 1, bookings: [released]})).toEqual({
      kind: 'full',
      max: 1,
    });
  });
});

describe('slotOffer', () => {
  const cases: [string, Slot, object][] = [
    [
      'a free time',
      {...TIMES, status: 'available', subscriptionId: null},
      {look: 'free', label: t.slots.free, tone: 'muted', locked: false},
    ],
    [
      'a free time the apartment queued for',
      {...TIMES, status: 'available', subscriptionId: 'sub-1'},
      {look: 'freeNow', label: t.slots.freeNow, tone: 'strong', locked: false},
    ],
    [
      'its own time',
      {...TIMES, status: 'mine', bookingId: 'b-1', started: false},
      {look: 'mine', label: t.slots.mine, mark: 'dot', locked: false},
    ],
    [
      'a time open for drop-in',
      {...TIMES, status: 'walkin'},
      {look: 'closed', label: t.slots.dropIn, mark: 'lock', locked: true},
    ],
    [
      'a taken time',
      {...TIMES, status: 'booked', started: false, subscriptionId: null},
      {look: 'closed', label: t.slots.taken, tone: 'faint', locked: false},
    ],
    [
      'a taken time it queues for',
      {...TIMES, status: 'booked', started: false, subscriptionId: 'sub-1'},
      {look: 'closed', label: t.slots.queued, tone: 'accent', locked: false},
    ],
    [
      'a taken time that has started',
      {...TIMES, status: 'booked', started: true, subscriptionId: null},
      {mark: 'lock', locked: true, action: null},
    ],
  ];

  test.each(cases)('%s', (_, slot, expected) => {
    expect(slotOffer(slot, SAUNA, NOTHING_HELD, t)).toMatchObject(expected);
  });

  test('its own time is cancelled, or released once started', () => {
    const mine: Slot = {
      ...TIMES,
      status: 'mine',
      bookingId: 'b-1',
      started: false,
    };

    expect(slotOffer(mine, SAUNA, NOTHING_HELD, t).action?.kind).toBe('cancel');
    expect(
      slotOffer({...mine, started: true}, SAUNA, NOTHING_HELD, t).action?.kind,
    ).toBe('release');
  });

  test('a free time offers what taking it means', () => {
    const free: Slot = {...TIMES, status: 'available', subscriptionId: null};

    expect(
      slotOffer(free, SAUNA, {max: 1, bookings: [HELD]}, t).action,
    ).toEqual({kind: 'swap', target: TARGET, choices: [HELD], held: 1});
  });
});

describe('cards in my times', () => {
  const booking: Booking = {
    ...TIMES,
    id: 'b-1',
    endsAt: '2030-01-15T18:00:00Z',
    started: false,
    released: false,
    resourceId: 'sauna',
    resourceName: 'Bastu',
    resourceKind: 'sauna',
  };

  test('a booking is cancelled, released once started, and left once released', () => {
    expect(bookingCard(booking, t).primary).toMatchObject({
      label: t.times.cancel,
      action: {kind: 'cancel'},
    });
    expect(bookingCard({...booking, started: true}, t).primary).toMatchObject({
      label: t.times.done,
      action: {kind: 'release'},
    });
    expect(bookingCard({...booking, started: true, released: true}, t)).toEqual(
      {
        ended: true,
        badge: {label: t.times.ended, tone: 'muted'},
        primary: null,
        secondary: null,
      },
    );
  });

  const subscription: Subscription = {
    ...TIMES,
    id: 'sub-1',
    endsAt: '2030-01-15T18:00:00Z',
    available: false,
    started: false,
    resourceId: 'sauna',
    resourceName: 'Bastu',
    resourceKind: 'sauna',
    held: NOTHING_HELD,
  };

  test('a queue place only leaves until its time is free', () => {
    expect(queueCard(subscription, t)).toMatchObject({
      badge: {label: t.times.queue},
      primary: {label: t.times.leaveQueue, action: {kind: 'leaveQueue'}},
      secondary: null,
    });
  });

  test('a freed queue place is taken the way the day view takes it', () => {
    const freed = {
      ...subscription,
      available: true,
      held: {max: 1, bookings: [HELD]},
    };

    expect(queueCard(freed, t)).toMatchObject({
      badge: {label: t.times.freeNow},
      primary: {
        label: t.times.book,
        solid: true,
        action: {kind: 'swap', choices: [HELD]},
      },
      secondary: {label: t.times.leaveQueue},
    });
  });

  test('a freed queue place that has started is drop-in, only left', () => {
    expect(
      queueCard({...subscription, available: true, started: true}, t),
    ).toMatchObject({
      badge: {label: t.times.dropIn},
      primary: {action: {kind: 'leaveQueue'}},
      secondary: null,
    });
  });
});
