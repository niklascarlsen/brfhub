import assert from 'node:assert/strict';
import {after, before, beforeEach, test} from 'node:test';

import {eq, sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {
  bookings,
  organizations,
  pushTokens,
  session,
  subscriptions,
  user,
} from '../db/schema.js';
import {listPushTokens} from '../pushToken/pushToken.service.js';
import type {Locale} from '../lib/locale.js';
import {addDays, isoDateIn, slotEndsAt} from '../lib/time.js';
import {withTimeout} from '../lib/timeout.js';
import type {BookingRules, Resource} from '../resource/resource.dto.js';
import type {ResourceSchedule, Slots} from '../slot/slot.dto.js';
import type {Subscription} from '../subscription/subscription.dto.js';
import {listSubscribers} from '../subscription/subscription.query.js';
import {
  assertTestDatabase,
  codeOf,
  memoryMail,
  memoryPush,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  seedOrganization,
  sessionFor,
  signIn as signInTo,
  waitUntilBlocked,
} from '../test/fixtures.js';
import type {Booking, CreatedBooking} from './booking.dto.js';
import {releasedNotification} from './booking.notification.js';
import {lockApartmentBookings} from './lifecycle.js';

const LAUNDRY_1 = 'laundry-1';
const LAUNDRY_2 = 'laundry-2';
const DRYING = 'drying-room';
const SAUNA = 'sauna';

const ORGANIZATION_ID = 'test';

const ORGANIZATION = {
  id: ORGANIZATION_ID,
  name: 'Testföreningen',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
};

const KINDS = [
  {id: 'laundry', name: {sv: 'Tvätt'}, maxActive: 1},
  {id: 'drying', name: {sv: 'Tork'}, maxActive: 1},
  {id: 'sauna', name: {sv: 'Bastu'}, maxActive: 2},
];

const APARTMENTS = ['11', '12', '13', '14', '15', '21', '31'];

const RESOURCES = [
  {
    id: LAUNDRY_1,
    kindId: 'laundry',
    name: {sv: 'Tvättstuga 1'},
    tags: {sv: ['torktumlare']},
    sortOrder: 1,
  },
  {
    id: LAUNDRY_2,
    kindId: 'laundry',
    name: {sv: 'Tvättstuga 2'},
    tags: {},
    sortOrder: 2,
  },
  {
    id: DRYING,
    kindId: 'drying',
    name: {sv: 'Torkrum'},
    tags: {sv: ['avfuktare']},
    sortOrder: 3,
  },
  {
    id: SAUNA,
    kindId: 'sauna',
    name: {sv: 'Bastu'},
    tags: {},
    sortOrder: 4,
  },
];

type SlotSpec = {start: string; end: string; endOffsetDays?: number};

const DAY_SLOTS: SlotSpec[] = [
  {start: '07:00', end: '10:00'},
  {start: '10:00', end: '13:00'},
  {start: '13:00', end: '16:00'},
];

const ALL_DAY = {start: '00:00', end: '00:00', endOffsetDays: 1};
const EVENING = {start: '16:00', end: '20:00'};
const NIGHT = {start: '22:00', end: '07:00', endOffsetDays: 1};

const RESOURCE_SLOTS = [
  ...[LAUNDRY_1, LAUNDRY_2].flatMap((resourceId) =>
    [...DAY_SLOTS, ALL_DAY].map((slot) => ({...slot, resourceId})),
  ),
  ...[...DAY_SLOTS, EVENING, NIGHT].map((slot) => ({
    ...slot,
    resourceId: DRYING,
  })),
  ...DAY_SLOTS.map((slot) => ({...slot, resourceId: SAUNA})),
];

const TENANT = '12';
const NEIGHBOUR = '21';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

function dateInDays(days: number): string {
  return addDays(isoDateIn(ORGANIZATION.timeZone), days);
}

const bookableDate = dateInDays(3);
const dayAfterBookable = dateInDays(4);
const today = dateInDays(0);
const yesterday = dateInDays(-1);
const beyondWindow = dateInDays(40);

const memberIds = new Map<string, string>();

function memberId(label: string): string {
  const id = memberIds.get(label);

  if (!id) {
    throw new Error(`Unknown member ${label}`);
  }

  return id;
}

let server: Awaited<ReturnType<typeof buildApp>>;
const push = memoryPush();
const mail = memoryMail();
const cookies = new Map<string, string>();

function emailOf(label: string) {
  return `${label}@example.com`;
}

function signIn(email: string, password?: string) {
  return signInTo(server, email, password);
}

function signedInAs(label: string) {
  const cookie = cookies.get(label);

  if (!cookie) {
    throw new Error(`No session for ${label}`);
  }

  return {cookie};
}

before(async () => {
  await assertTestDatabase();

  server = await buildApp({logger: false, push: push.send, mail: mail.send});
  await resetDatabase();

  const ids = await seedOrganization({
    organization: ORGANIZATION,
    kinds: KINDS,
    resources: RESOURCES,
    slots: RESOURCE_SLOTS,
    apartments: APARTMENTS,
    emailOf,
    adminEmail: 'admin@example.com',
  });

  for (const [label, id] of ids) {
    memberIds.set(label, id);
    cookies.set(label, (await signIn(emailOf(label))).cookie);
  }
});

beforeEach(async () => {
  // A test that freed a slot may still be announcing it.
  await server.notifier.idle();
  await db.execute(sql`truncate bookings, subscriptions, push_tokens cascade`);
  push.clear();
});

after(async () => {
  await server.close();
  await pool.end();
});

function book(userId: string, payload: Record<string, unknown>) {
  return server.inject({
    method: 'POST',
    url: '/bookings',
    headers: signedInAs(userId),
    payload: {resourceId: LAUNDRY_1, ...payload},
  });
}

function myBookings(userId: string) {
  return server.inject({
    method: 'GET',
    url: '/bookings',
    headers: signedInAs(userId),
  });
}

function cancel(userId: string, id: string) {
  return server.inject({
    method: 'DELETE',
    url: `/bookings/${id}`,
    headers: signedInAs(userId),
  });
}

function slotsFor(userId: string, date: string, resourceId = LAUNDRY_1) {
  return server.inject({
    method: 'GET',
    url: `/slots?date=${date}&resourceId=${resourceId}`,
    headers: signedInAs(userId),
  });
}

function slotsBetween(
  userId: string,
  from: string,
  to: string,
  resourceId = LAUNDRY_1,
) {
  return server.inject({
    method: 'GET',
    url: `/slots?date=${from}&to=${to}&resourceId=${resourceId}`,
    headers: signedInAs(userId),
  });
}

function scheduleBetween(userId: string, from: string, to: string) {
  return server.inject({
    method: 'GET',
    url: `/schedule?from=${from}&to=${to}`,
    headers: signedInAs(userId),
  });
}

function startsIn(response: {json: <T>() => T}) {
  return response.json<Slots>().slots.map((slot) => slot.start);
}

async function insertStartedBooking(
  userId: string,
  resourceId: string = LAUNDRY_1,
) {
  const [row] = await db
    .insert(bookings)
    .values({
      organizationId: ORGANIZATION_ID,
      memberId: memberId(userId),
      date: today,
      start: ALL_DAY.start,
      end: ALL_DAY.end,
      resourceId,
      endsAt: slotEndsAt(
        ORGANIZATION.timeZone,
        today,
        ALL_DAY.end,
        ALL_DAY.endOffsetDays,
      ),
    })
    .returning({id: bookings.id});

  if (!row) {
    throw new Error('Insert returned no row');
  }

  return row;
}

function subscribe(userId: string, payload: Record<string, unknown>) {
  return server.inject({
    method: 'POST',
    url: '/subscriptions',
    headers: signedInAs(userId),
    payload: {resourceId: LAUNDRY_1, ...payload},
  });
}

function mySubscriptions(userId: string) {
  return server.inject({
    method: 'GET',
    url: '/subscriptions',
    headers: signedInAs(userId),
  });
}

function unsubscribe(userId: string, id: string) {
  return server.inject({
    method: 'DELETE',
    url: `/subscriptions/${id}`,
    headers: signedInAs(userId),
  });
}

test('books a free slot', async () => {
  const response = await book(TENANT, {date: bookableDate, start: '07:00'});
  const created = response.json<CreatedBooking>();

  assert.equal(response.statusCode, 201);
  assert.equal(created.date, bookableDate);
  assert.equal(created.start, '07:00');
  assert.equal(created.resourceId, LAUNDRY_1);
  assert.equal(created.resourceKind, 'laundry');
  assert.equal(created.resourceName, 'Tvättstuga 1');
  assert.equal(created.start, '07:00');
  assert.equal(created.end, '10:00');
  assert.equal(created.replacedId, null);
  assert.equal(created.started, false);
  assert.equal(created.released, false);
});

test('rejects a slot another apartment already took', async () => {
  await book(NEIGHBOUR, {date: bookableDate, start: '10:00'});

  const response = await book(TENANT, {date: bookableDate, start: '10:00'});

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'SLOT_TAKEN');

  const mine = await myBookings(TENANT);
  assert.deepEqual(mine.json<Booking[]>(), []);
});

test('rejects a second booking for the same apartment', async () => {
  const first = await book(TENANT, {date: bookableDate, start: '07:00'});

  const response = await book(TENANT, {date: bookableDate, start: '13:00'});

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.id),
    [first.json<CreatedBooking>().id],
  );
});

test('replaces the booking it names when the cap is reached', async () => {
  const first = await book(TENANT, {date: bookableDate, start: '07:00'});

  const response = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    replaceBookingId: first.json<CreatedBooking>().id,
  });
  const created = response.json<CreatedBooking>();

  assert.equal(response.statusCode, 201);
  assert.equal(created.start, '13:00');
  assert.equal(created.replacedId, first.json<CreatedBooking>().id);

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.start),
    ['13:00'],
  );
});

test('rejects an unknown slot', async () => {
  const response = await book(TENANT, {date: bookableDate, start: '05:00'});

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('rejects a slot that has already ended', async () => {
  const response = await book(TENANT, {date: yesterday, start: '07:00'});

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'SLOT_IN_PAST');
});

test('rejects a slot that has already started', async () => {
  const response = await book(TENANT, {date: today, start: '00:00'});

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'SLOT_STARTED');
});

test('rejects a date beyond the booking window', async () => {
  const response = await book(TENANT, {date: beyondWindow, start: '07:00'});

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'OUTSIDE_BOOKING_WINDOW');
});

test('rejects a request without a session', async () => {
  const response = await server.inject({method: 'GET', url: '/bookings'});

  assert.equal(response.statusCode, 401);
  assert.equal(codeOf(response), 'UNAUTHORIZED');
});

test('cancels its own booking', async () => {
  const created = await book(TENANT, {date: bookableDate, start: '07:00'});

  const response = await cancel(TENANT, created.json<CreatedBooking>().id);

  assert.equal(response.statusCode, 204);

  const mine = await myBookings(TENANT);
  assert.deepEqual(mine.json<Booking[]>(), []);

  const again = await book(TENANT, {date: bookableDate, start: '10:00'});
  assert.equal(again.statusCode, 201);
});

test('opens a started booking for walk-in without freeing the apartment', async () => {
  const {id} = await insertStartedBooking(TENANT);

  const response = await cancel(TENANT, id);

  assert.equal(response.statusCode, 204);

  const mine = await myBookings(TENANT);
  const [kept] = mine.json<Booking[]>();
  assert.equal(kept?.id, id);
  assert.equal(kept?.started, true);
  assert.equal(kept?.released, true);

  const listed = await slotsFor(NEIGHBOUR, today);
  assert.equal(
    listed.json<Slots>().slots.find((slot) => slot.start === '00:00')?.status,
    'walkin',
  );

  const own = await slotsFor(TENANT, today);
  assert.equal(
    own.json<Slots>().slots.find((slot) => slot.start === '00:00')?.status,
    'walkin',
  );
});

test('rejects a new booking after the apartment opens a started slot', async () => {
  const {id} = await insertStartedBooking(TENANT);
  await cancel(TENANT, id);

  const again = await book(TENANT, {date: bookableDate, start: '07:00'});
  assert.equal(again.statusCode, 409);
  assert.equal(codeOf(again), 'HAS_ACTIVE_BOOKING');

  const replace = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    replaceBookingId: id,
  });
  assert.equal(replace.statusCode, 409);
  assert.equal(codeOf(replace), 'HAS_ACTIVE_BOOKING');

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.id),
    [id],
  );
});

test('refuses to swap away a booking that has started', async () => {
  const {id} = await insertStartedBooking(TENANT);

  const swap = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    replaceBookingId: id,
  });
  assert.equal(swap.statusCode, 409);
  assert.equal(codeOf(swap), 'HAS_ACTIVE_BOOKING');

  const [kept, ...rest] = (await myBookings(TENANT)).json<Booking[]>();
  assert.equal(kept?.id, id);
  assert.equal(kept?.started, true);
  assert.equal(kept?.released, false);
  assert.deepEqual(rest, []);
});

test('keeps the queue after a drop-in so the subscriber can leave', async () => {
  const {id} = await insertStartedBooking(TENANT);
  await db.insert(subscriptions).values({
    organizationId: ORGANIZATION_ID,
    memberId: memberId(NEIGHBOUR),
    date: today,
    start: ALL_DAY.start,
    end: ALL_DAY.end,
    resourceId: LAUNDRY_1,
    endsAt: slotEndsAt(
      ORGANIZATION.timeZone,
      today,
      ALL_DAY.end,
      ALL_DAY.endOffsetDays,
    ),
  });

  await cancel(TENANT, id);

  const queued = await mySubscriptions(NEIGHBOUR);
  const [held] = queued.json<Subscription[]>();
  assert.equal(held?.available, true);
  assert.equal(held?.started, true);

  const take = await book(NEIGHBOUR, {date: today, start: '00:00'});
  assert.equal(take.statusCode, 400);
  assert.equal(codeOf(take), 'SLOT_STARTED');

  const left = await unsubscribe(NEIGHBOUR, held.id);
  assert.equal(left.statusCode, 204);
  assert.deepEqual(
    (await mySubscriptions(NEIGHBOUR)).json<Subscription[]>(),
    [],
  );
});

test('opening an already released booking is a no-op', async () => {
  const {id} = await insertStartedBooking(TENANT);

  assert.equal((await cancel(TENANT, id)).statusCode, 204);
  assert.equal((await cancel(TENANT, id)).statusCode, 204);

  const mine = await myBookings(TENANT);
  const [kept] = mine.json<Booking[]>();
  assert.equal(kept?.id, id);
  assert.equal(kept?.released, true);
});

test('rejects cancelling another apartment booking', async () => {
  const created = await book(NEIGHBOUR, {
    date: bookableDate,
    start: '07:00',
  });

  const response = await cancel(TENANT, created.json<CreatedBooking>().id);

  assert.equal(response.statusCode, 403);
  assert.equal(codeOf(response), 'FORBIDDEN');

  const theirs = await myBookings(NEIGHBOUR);
  assert.equal(theirs.json<Booking[]>().length, 1);
});

test('cancelling a booking already gone is done', async () => {
  const created = await book(TENANT, {date: bookableDate, start: '07:00'});
  const {id} = created.json<CreatedBooking>();

  assert.equal((await cancel(TENANT, id)).statusCode, 204);
  assert.equal((await cancel(TENANT, id)).statusCode, 204);
  assert.equal((await cancel(TENANT, UNKNOWN_ID)).statusCode, 204);
});

test('leaving a queue already left is done', async () => {
  await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  const queued = await subscribe(TENANT, {date: bookableDate, start: '07:00'});
  const {id} = queued.json<Subscription>();

  assert.equal((await unsubscribe(TENANT, id)).statusCode, 204);
  assert.equal((await unsubscribe(TENANT, id)).statusCode, 204);
});

test('lets only one apartment take a slot when several book at once', async () => {
  const apartments = ['11', '12', '13', '14', '15'];

  const responses = await Promise.all(
    apartments.map((apartment) =>
      book(apartment, {date: bookableDate, start: '07:00'}),
    ),
  );

  assert.equal(
    responses.filter((response) => response.statusCode === 201).length,
    1,
  );
  assert.deepEqual(
    new Set(
      responses
        .filter((response) => response.statusCode === 409)
        .map((response) => codeOf(response)),
    ),
    new Set(['SLOT_TAKEN']),
  );
});

test('keeps an apartment at one booking when it books several at once', async () => {
  const responses = await Promise.all(
    ['07:00', '10:00', '13:00'].map((start) =>
      book(TENANT, {date: bookableDate, start}),
    ),
  );

  assert.equal(
    responses.filter((response) => response.statusCode === 201).length,
    1,
  );

  const mine = await myBookings(TENANT);
  assert.equal(mine.json<Booking[]>().length, 1);
});

test('drops the subscription when the subscriber books the freed slot', async () => {
  const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  await subscribe(TENANT, {date: bookableDate, start: '07:00'});

  await cancel(NEIGHBOUR, theirs.json<CreatedBooking>().id);

  const queued = await mySubscriptions(TENANT);
  assert.deepEqual(
    queued.json<Subscription[]>().map((subscription) => subscription.available),
    [true],
  );

  const response = await book(TENANT, {date: bookableDate, start: '07:00'});

  assert.equal(response.statusCode, 201);

  const afterBooking = await mySubscriptions(TENANT);
  assert.deepEqual(afterBooking.json<Subscription[]>(), []);

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.start),
    ['07:00'],
  );
});

test('queueing twice for the same slot changes nothing', async () => {
  await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});

  const first = await subscribe(TENANT, {date: bookableDate, start: '07:00'});
  const second = await subscribe(TENANT, {date: bookableDate, start: '07:00'});

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(second.json<Subscription>().id, first.json<Subscription>().id);

  const queued = await mySubscriptions(TENANT);
  assert.equal(queued.json<Subscription[]>().length, 1);
});

test('rejects queueing for your own booking', async () => {
  await book(TENANT, {date: bookableDate, start: '07:00'});

  const response = await subscribe(TENANT, {
    date: bookableDate,
    start: '07:00',
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');

  const queued = await mySubscriptions(TENANT);
  assert.deepEqual(queued.json<Subscription[]>(), []);
});

test('lists bookable resources', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/resources',
    headers: signedInAs(TENANT),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.json<Resource[]>().map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      tags: resource.tags,
    })),
    [
      {id: LAUNDRY_1, kind: 'laundry', tags: ['torktumlare']},
      {id: LAUNDRY_2, kind: 'laundry', tags: []},
      {id: DRYING, kind: 'drying', tags: ['avfuktare']},
      {id: SAUNA, kind: 'sauna', tags: []},
    ],
  );
});

test('rejects slots for an unknown resource', async () => {
  const response = await slotsFor(TENANT, bookableDate, 'nope');

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('rejects a booking for an unknown resource', async () => {
  const response = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: 'nope',
  });

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('lets two apartments book the same slot in different laundry rooms', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });
  const second = await book(NEIGHBOUR, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_2,
  });

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);

  const laundry1 = await slotsFor(TENANT, bookableDate, LAUNDRY_1);
  const laundry2 = await slotsFor(NEIGHBOUR, bookableDate, LAUNDRY_2);

  assert.equal(
    laundry1.json<Slots>().slots.find((slot) => slot.start === '07:00')?.status,
    'mine',
  );
  assert.equal(
    laundry2.json<Slots>().slots.find((slot) => slot.start === '07:00')?.status,
    'mine',
  );
});

test('rejects a second laundry booking even in the other room', async () => {
  await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });

  const response = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    resourceId: LAUNDRY_2,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
});

test('lets an apartment book laundry and drying at the same time', async () => {
  const laundry = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });
  const drying = await book(TENANT, {
    date: bookableDate,
    start: '10:00',
    resourceId: DRYING,
  });

  assert.equal(laundry.statusCode, 201);
  assert.equal(drying.statusCode, 201);

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine
      .json<Booking[]>()
      .map((booking) => booking.resourceId)
      .sort(),
    [DRYING, LAUNDRY_1].sort(),
  );
});

test('replaces only the laundry booking when switching rooms', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });
  await book(TENANT, {
    date: bookableDate,
    start: '10:00',
    resourceId: DRYING,
  });

  const swapped = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    resourceId: LAUNDRY_2,
    replaceBookingId: first.json<CreatedBooking>().id,
  });

  assert.equal(swapped.statusCode, 201);
  assert.equal(
    swapped.json<CreatedBooking>().replacedId,
    first.json<CreatedBooking>().id,
  );

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine
      .json<Booking[]>()
      .map((booking) => `${booking.resourceId}:${booking.start}`)
      .sort(),
    [`${DRYING}:10:00`, `${LAUNDRY_2}:13:00`].sort(),
  );
});

test('rejects a second drying booking', async () => {
  await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: DRYING,
  });

  const response = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    resourceId: DRYING,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
});

test('keeps the laundry queue off the other room', async () => {
  await book(NEIGHBOUR, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });
  await subscribe(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });

  const otherRoom = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.equal(
    otherRoom.json<Slots>().slots.find((slot) => slot.start === '07:00')
      ?.status,
    'available',
  );

  const queued = await slotsFor(TENANT, bookableDate, LAUNDRY_1);
  const slot = queued
    .json<Slots>()
    .slots.find((item) => item.start === '07:00');
  assert.equal(slot?.status, 'booked');
  assert.ok(slot?.status === 'booked' && slot.subscriptionId);
});

function heldIds(held: Slots['held']) {
  return held.bookings.map((booking) => booking.id);
}

test('slots report what the apartment holds of the same kind', async () => {
  const before = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.deepEqual(before.json<Slots>().held, {max: 1, bookings: []});

  const created = (
    await book(TENANT, {date: bookableDate, start: '07:00'})
  ).json<CreatedBooking>();

  const sameKind = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.deepEqual(sameKind.json<Slots>().held, {
    max: 1,
    bookings: [
      {
        id: created.id,
        date: bookableDate,
        start: '07:00',
        end: '10:00',
        resourceName: 'Tvättstuga 1',
        started: false,
        released: false,
      },
    ],
  });

  const otherKind = await slotsFor(TENANT, bookableDate, DRYING);
  assert.deepEqual(heldIds(otherKind.json<Slots>().held), []);
});

test('a kind with room for two reports both bookings and its cap', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: SAUNA,
  });
  const second = await book(TENANT, {
    date: bookableDate,
    start: '10:00',
    resourceId: SAUNA,
  });

  const {held} = (await slotsFor(TENANT, bookableDate, SAUNA)).json<Slots>();

  assert.equal(held.max, 2);
  assert.deepEqual(heldIds(held), [
    first.json<CreatedBooking>().id,
    second.json<CreatedBooking>().id,
  ]);
});

test('at the cap of two, swaps the booking it names and keeps the other', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: SAUNA,
  });
  const second = await book(TENANT, {
    date: bookableDate,
    start: '10:00',
    resourceId: SAUNA,
  });

  const third = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    resourceId: SAUNA,
    replaceBookingId: second.json<CreatedBooking>().id,
  });

  assert.equal(third.statusCode, 201);
  assert.equal(
    third.json<CreatedBooking>().replacedId,
    second.json<CreatedBooking>().id,
  );
  assert.deepEqual(
    (await myBookings(TENANT)).json<Booking[]>().map((booking) => booking.id),
    [first.json<CreatedBooking>().id, third.json<CreatedBooking>().id],
  );
});

test('at the cap, refuses a swap that names no booking of the kind', async () => {
  const drying = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: DRYING,
  });
  for (const start of ['07:00', '10:00']) {
    await book(TENANT, {date: bookableDate, start, resourceId: SAUNA});
  }

  for (const replaceBookingId of [
    undefined,
    drying.json<CreatedBooking>().id,
    UNKNOWN_ID,
  ]) {
    const response = await book(TENANT, {
      date: bookableDate,
      start: '13:00',
      resourceId: SAUNA,
      ...(replaceBookingId ? {replaceBookingId} : {}),
    });

    assert.equal(response.statusCode, 409);
    assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
  }
  assert.equal((await myBookings(TENANT)).json<Booking[]>().length, 3);
});

test('under the cap, still gives up the booking it names', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: SAUNA,
  });

  const second = await book(TENANT, {
    date: bookableDate,
    start: '10:00',
    resourceId: SAUNA,
    replaceBookingId: first.json<CreatedBooking>().id,
  });

  assert.equal(second.statusCode, 201);
  assert.equal(
    second.json<CreatedBooking>().replacedId,
    first.json<CreatedBooking>().id,
  );
  assert.deepEqual(
    (await myBookings(TENANT)).json<Booking[]>().map((booking) => booking.id),
    [second.json<CreatedBooking>().id],
  );
});

test('a named booking already gone leaves only the cap to check', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: SAUNA,
  });
  const {id: gone} = (
    await book(TENANT, {date: bookableDate, start: '10:00', resourceId: SAUNA})
  ).json<CreatedBooking>();
  await cancel(TENANT, gone);

  const response = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    resourceId: SAUNA,
    replaceBookingId: gone,
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json<CreatedBooking>().replacedId, null);
  assert.deepEqual(
    (await myBookings(TENANT)).json<Booking[]>().map((booking) => booking.id),
    [first.json<CreatedBooking>().id, response.json<CreatedBooking>().id],
  );
});

test('a queue place reports what the apartment holds of its kind', async () => {
  await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  const mine = await book(TENANT, {date: bookableDate, start: '10:00'});
  const queued = await subscribe(TENANT, {date: bookableDate, start: '07:00'});

  const expected = {max: 1, ids: [mine.json<CreatedBooking>().id]};
  const fromQueueing = queued.json<Subscription>().held;
  const [listed] = (await mySubscriptions(TENANT)).json<Subscription[]>();

  for (const held of [fromQueueing, listed?.held]) {
    assert.deepEqual(
      {max: held?.max, ids: held?.bookings.map((booking) => booking.id)},
      expected,
    );
  }
});

test('slots report a released booking as still active', async () => {
  const {id} = await insertStartedBooking(TENANT);
  await cancel(TENANT, id);

  const listed = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.deepEqual(
    listed.json<Slots>().held.bookings.map(({id: held, started, released}) => ({
      id: held,
      started,
      released,
    })),
    [{id, started: true, released: true}],
  );
});

test('a started booking in one room does not occupy the other', async () => {
  await insertStartedBooking(TENANT, LAUNDRY_1);

  const other = await slotsFor(NEIGHBOUR, today, LAUNDRY_2);
  assert.equal(
    other.json<Slots>().slots.find((slot) => slot.start === '00:00')?.status,
    'walkin',
  );

  const ownOther = await slotsFor(TENANT, today, LAUNDRY_2);
  assert.equal(
    ownOther.json<Slots>().slots.find((slot) => slot.start === '00:00')?.status,
    'walkin',
  );
});

test('cancelling one room does not free a queue on the other', async () => {
  const first = await book(NEIGHBOUR, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });
  await book('14', {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_2,
  });
  await subscribe(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_2,
  });

  await cancel(NEIGHBOUR, first.json<CreatedBooking>().id);

  const queued = await mySubscriptions(TENANT);
  assert.deepEqual(
    queued.json<Subscription[]>().map((item) => item.available),
    [false],
  );
});

test('lists queue members only for that resource', async () => {
  await book(NEIGHBOUR, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });
  await book('14', {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_2,
  });
  await subscribe(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_1,
  });

  const laundry1 = await listSubscribers(LAUNDRY_1, bookableDate, '07:00');
  const laundry2 = await listSubscribers(LAUNDRY_2, bookableDate, '07:00');

  assert.deepEqual(
    laundry1.map((row) => row.memberId),
    [memberId(TENANT)],
  );
  assert.deepEqual(laundry2, []);
});

test('releasing a started laundry booking still blocks the other laundry room', async () => {
  const {id} = await insertStartedBooking(TENANT, LAUNDRY_1);
  await cancel(TENANT, id);

  const response = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: LAUNDRY_2,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
});

test('rejects a wrong code, a wrong password and a forged cookie', async () => {
  await server.inject({
    method: 'POST',
    url: '/auth/email-otp/send-verification-otp',
    headers: {origin: ORIGIN},
    payload: {email: emailOf(TENANT), type: 'sign-in'},
  });
  const wrongCode = await server.inject({
    method: 'POST',
    url: '/auth/sign-in/email-otp',
    headers: {origin: ORIGIN},
    payload: {email: emailOf(TENANT), otp: '000000'},
  });
  assert.equal(wrongCode.statusCode, 400);

  const {response} = await signIn('admin@example.com', 'wrong');
  assert.equal(response.statusCode, 401);

  const forged = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie: 'better-auth.session_token=not-a-session'},
  });
  assert.equal(forged.statusCode, 401);
  assert.equal(codeOf(forged), 'UNAUTHORIZED');
});

test('does not let anyone register an account', async () => {
  const response = await server.inject({
    method: 'POST',
    url: '/auth/sign-up/email',
    headers: {origin: ORIGIN},
    payload: {email: 'new@example.com', password: PASSWORD, name: 'Ny'},
  });

  assert.equal(response.statusCode, 400);
  assert.equal(
    response.json<{code: string}>().code,
    'EMAIL_PASSWORD_SIGN_UP_DISABLED',
  );
});

test('an apartment drops only its own push token', async () => {
  const mine = 'ExponentPushToken[mine]';
  const theirs = 'ExponentPushToken[theirs]';
  await db.insert(pushTokens).values([
    {
      token: mine,
      memberId: memberId(TENANT),
      sessionId: await sessionFor(memberId(TENANT)),
      locale: 'sv',
    },
    {
      token: theirs,
      memberId: memberId(NEIGHBOUR),
      sessionId: await sessionFor(memberId(NEIGHBOUR)),
      locale: 'sv',
    },
  ]);

  for (const token of [mine, theirs]) {
    const response = await server.inject({
      method: 'DELETE',
      url: '/push-tokens',
      headers: signedInAs(TENANT),
      payload: {token},
    });
    assert.equal(response.statusCode, 204);
  }

  const left = await db.select({token: pushTokens.token}).from(pushTokens);
  assert.deepEqual(
    left.map((row) => row.token),
    [theirs],
  );
});

test('signing out takes the push token of the device with it', async () => {
  const token = 'ExponentPushToken[signed-out]';
  const {cookie} = await signIn(emailOf(TENANT));
  const registered = await server.inject({
    method: 'POST',
    url: '/push-tokens',
    headers: {cookie},
    payload: {token, locale: 'sv'},
  });
  assert.equal(registered.statusCode, 204);

  // The device could not drop it itself, such as with notifications
  // turned off in the phone's settings.
  const signedOut = await server.inject({
    method: 'POST',
    url: '/auth/sign-out',
    headers: {origin: ORIGIN, cookie},
  });
  assert.equal(signedOut.statusCode, 200);

  assert.deepEqual(
    await db.select().from(pushTokens).where(eq(pushTokens.token, token)),
    [],
  );
});

test('a device whose session ran out gets no push', async () => {
  const sessionId = await sessionFor(memberId(TENANT));
  await db.insert(pushTokens).values({
    token: 'ExponentPushToken[ran-out]',
    memberId: memberId(TENANT),
    sessionId,
    locale: 'sv',
  });
  await db
    .update(session)
    .set({expiresAt: sql`now() - interval '1 minute'`})
    .where(eq(session.id, sessionId));

  const tokens = await listPushTokens([memberId(TENANT)]);

  assert.equal(
    tokens.some((row) => row.token === 'ExponentPushToken[ran-out]'),
    false,
  );
});

test('a device an admin who lives here signed in on a week ago gets no push', async () => {
  const token = 'ExponentPushToken[admin-week]';
  const sessionId = await sessionFor(memberId(TENANT));
  await db.insert(pushTokens).values({
    token,
    memberId: memberId(TENANT),
    sessionId,
    locale: 'sv',
  });
  // Used since, so Better Auth has kept it from running out.
  await db
    .update(session)
    .set({createdAt: sql`now() - interval '8 days'`})
    .where(eq(session.id, sessionId));
  const listed = async () =>
    (await listPushTokens([memberId(TENANT)])).some(
      (row) => row.token === token,
    );

  // A resident stays signed in for as long as the app is used.
  assert.equal(await listed(), true);

  const [account] = await db
    .update(user)
    .set({admin: true})
    .where(eq(user.memberId, memberId(TENANT)))
    .returning({id: user.id});
  try {
    assert.equal(await listed(), false);
  } finally {
    await db
      .update(user)
      .set({admin: false})
      .where(eq(user.id, account?.id ?? ''));
    await db.delete(pushTokens).where(eq(pushTokens.token, token));
  }
});

test('a device registers its token in its language and can switch', async () => {
  const token = 'ExponentPushToken[switching]';
  const register = (locale: string) =>
    server.inject({
      method: 'POST',
      url: '/push-tokens',
      headers: signedInAs(TENANT),
      payload: {token, locale},
    });
  const stored = () =>
    db
      .select({locale: pushTokens.locale})
      .from(pushTokens)
      .where(eq(pushTokens.token, token))
      .then((rows) => rows.map((row) => row.locale));

  assert.equal((await register('en')).statusCode, 204);
  assert.deepEqual(await stored(), ['en']);

  assert.equal((await register('sv')).statusCode, 204);
  assert.deepEqual(await stored(), ['sv']);

  const unknown = await register('de');
  assert.equal(unknown.statusCode, 400);
  assert.equal(codeOf(unknown), 'VALIDATION');
  assert.deepEqual(await stored(), ['sv']);
});

test('the released slot is announced in each device language', () => {
  const slot = {
    date: '2026-10-10',
    start: '07:00',
    end: '10:00',
    resourceId: LAUNDRY_1,
    resourceName: {sv: 'Tvättstuga 1', en: 'Laundry room 1'},
  };

  assert.deepEqual(releasedNotification('sv', slot), {
    title: 'En tid blev ledig',
    body: 'Tvättstuga 1, lördag 10 oktober 07:00–10:00 är ledig – först till kvarn.',
    channel: 'slots',
    data: {date: '2026-10-10', start: '07:00', resourceId: LAUNDRY_1},
  });
  assert.deepEqual(releasedNotification('en', slot), {
    title: 'A slot opened up',
    body: 'Laundry room 1, Saturday 10 October 07:00–10:00 is free – first come, first served.',
    channel: 'slots',
    data: {date: '2026-10-10', start: '07:00', resourceId: LAUNDRY_1},
  });
});

async function addDevice(label: string, locale: Locale = 'sv') {
  await db.insert(pushTokens).values({
    token: `${label}-device`,
    memberId: memberId(label),
    sessionId: await sessionFor(memberId(label)),
    locale,
  });
}

// What the push service was handed once every send has run, by device.
async function pushed() {
  await server.notifier.idle();

  return push.sent
    .map(({to, title, data}) => ({to, title, start: data?.start}))
    .sort((a, b) => a.to.localeCompare(b.to));
}

// Fails instead of hanging when the response waits on something it should
// not, such as a push service held until the test lets it go. Generous, so
// a slow database does not fail it.
function within<T>(promise: Promise<T>): Promise<T> {
  return withTimeout(promise, 10_000, 'No response while push was held');
}

test('a cancelled slot is announced to its queue and nobody else', async () => {
  const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  await subscribe(TENANT, {date: bookableDate, start: '07:00'});
  await subscribe('13', {date: bookableDate, start: '07:00'});
  await subscribe('14', {date: bookableDate, start: '10:00'});
  for (const label of [TENANT, '13', '14', NEIGHBOUR]) {
    await addDevice(label);
  }

  await cancel(NEIGHBOUR, theirs.json<CreatedBooking>().id);

  assert.deepEqual(await pushed(), [
    {to: '12-device', title: 'En tid blev ledig', start: '07:00'},
    {to: '13-device', title: 'En tid blev ledig', start: '07:00'},
  ]);
});

test('each device hears of a freed slot in its own language', async () => {
  await db
    .update(organizations)
    .set({locales: ['sv', 'en']})
    .where(eq(organizations.id, ORGANIZATION_ID));

  try {
    const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
    await subscribe(TENANT, {date: bookableDate, start: '07:00'});
    await subscribe('13', {date: bookableDate, start: '07:00'});
    await addDevice(TENANT, 'en');
    await addDevice('13', 'sv');

    await cancel(NEIGHBOUR, theirs.json<CreatedBooking>().id);

    assert.deepEqual(
      (await pushed()).map(({to, title}) => ({to, title})),
      [
        {to: '12-device', title: 'A slot opened up'},
        {to: '13-device', title: 'En tid blev ledig'},
      ],
    );
  } finally {
    await db
      .update(organizations)
      .set({locales: ['sv']})
      .where(eq(organizations.id, ORGANIZATION_ID));
  }
});

test('a swap announces the slot the apartment gave up', async () => {
  const first = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  await subscribe(TENANT, {date: bookableDate, start: '07:00'});
  await addDevice(TENANT);
  await addDevice(NEIGHBOUR);

  const swapped = await book(NEIGHBOUR, {
    date: bookableDate,
    start: '10:00',
    replaceBookingId: first.json<CreatedBooking>().id,
  });

  assert.equal(swapped.statusCode, 201);
  assert.deepEqual(await pushed(), [
    {to: '12-device', title: 'En tid blev ledig', start: '07:00'},
  ]);
});

test('cancelling and swapping answer before the push service does', async () => {
  const first = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  await subscribe(TENANT, {date: bookableDate, start: '07:00'});
  await addDevice(TENANT);
  const release = push.hold();

  try {
    const swapped = await within(
      book(NEIGHBOUR, {
        date: bookableDate,
        start: '10:00',
        replaceBookingId: first.json<CreatedBooking>().id,
      }),
    );
    await subscribe(TENANT, {date: bookableDate, start: '10:00'});
    const cancelled = await within(
      cancel(NEIGHBOUR, swapped.json<CreatedBooking>().id),
    );

    assert.equal(
      swapped.json<CreatedBooking>().replacedId,
      first.json<CreatedBooking>().id,
    );
    assert.equal(cancelled.statusCode, 204);
    assert.deepEqual(push.sent, []);
  } finally {
    release();
  }

  assert.deepEqual((await pushed()).map((message) => message.start).sort(), [
    '07:00',
    '10:00',
  ]);
});

test('a device the push service no longer knows is dropped', async () => {
  const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  await subscribe(TENANT, {date: bookableDate, start: '07:00'});
  await subscribe('13', {date: bookableDate, start: '07:00'});
  await addDevice(TENANT);
  await addDevice('13');
  push.failWith([
    {token: '13-device', message: 'DeviceNotRegistered', unregistered: true},
  ]);

  await cancel(NEIGHBOUR, theirs.json<CreatedBooking>().id);
  await server.notifier.idle();

  assert.deepEqual(
    await db.select({token: pushTokens.token}).from(pushTokens),
    [{token: '12-device'}],
  );
});

// The tests below hold a lock from a transaction of their own and let go
// once the request they fired waits on it, so the request meets the other
// side of the race at the same point every run.

test('a cancel that waited while its slot started opens it for walk-in', async () => {
  const created = await book(TENANT, {date: bookableDate, start: '07:00'});
  const {id} = created.json<CreatedBooking>();
  let cancelled: ReturnType<typeof cancel> | undefined;

  await db.transaction(async (tx) => {
    await lockApartmentBookings(tx, memberId(TENANT));
    cancelled = cancel(TENANT, id);
    await waitUntilBlocked('advisory');

    // The slot starts while the cancel waits: moved to one that has.
    await tx
      .update(bookings)
      .set({
        date: today,
        start: ALL_DAY.start,
        end: ALL_DAY.end,
        endsAt: slotEndsAt(
          ORGANIZATION.timeZone,
          today,
          ALL_DAY.end,
          ALL_DAY.endOffsetDays,
        ),
      })
      .where(eq(bookings.id, id));
  });

  assert.equal((await cancelled)?.statusCode, 204);

  const [kept] = (await myBookings(TENANT)).json<Booking[]>();
  assert.equal(kept?.id, id);
  assert.equal(kept?.started, true);
  assert.equal(kept?.released, true);
});

test('a queue place taken while a cancel waits hears of the slot', async () => {
  const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  await addDevice(TENANT);
  let cancelled: ReturnType<typeof cancel> | undefined;

  await db.transaction(async (tx) => {
    await lockApartmentBookings(tx, memberId(NEIGHBOUR));
    cancelled = cancel(NEIGHBOUR, theirs.json<CreatedBooking>().id);
    await waitUntilBlocked('advisory');

    const queued = await subscribe(TENANT, {
      date: bookableDate,
      start: '07:00',
    });
    assert.equal(queued.statusCode, 201);
  });

  assert.equal((await cancelled)?.statusCode, 204);
  assert.deepEqual(await pushed(), [
    {to: '12-device', title: 'En tid blev ledig', start: '07:00'},
  ]);
});

test('a cancel that waits on a queue place being taken tells it', async () => {
  const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  const {id} = theirs.json<CreatedBooking>();
  await addDevice(TENANT);
  let cancelled: ReturnType<typeof cancel> | undefined;

  // Holds the booking and adds a queue place behind it as queueing does,
  // and commits only once the cancel waits on that booking.
  await db.transaction(async (tx) => {
    await tx
      .select({id: bookings.id})
      .from(bookings)
      .where(eq(bookings.id, id))
      .for('share');
    await tx.insert(subscriptions).values({
      organizationId: ORGANIZATION_ID,
      memberId: memberId(TENANT),
      date: bookableDate,
      start: '07:00',
      end: '10:00',
      resourceId: LAUNDRY_1,
      endsAt: slotEndsAt(ORGANIZATION.timeZone, bookableDate, '10:00'),
    });
    cancelled = cancel(NEIGHBOUR, id);
    await waitUntilBlocked('transactionid');
  });

  assert.equal((await cancelled)?.statusCode, 204);
  assert.deepEqual(await pushed(), [
    {to: '12-device', title: 'En tid blev ledig', start: '07:00'},
  ]);
});

test('queueing behind a cancel on its way answers that the slot is free', async () => {
  const theirs = await book(NEIGHBOUR, {date: bookableDate, start: '07:00'});
  let queued: ReturnType<typeof subscribe> | undefined;

  // Deletes the booking as a cancel does, and commits only once the
  // queueing has read the slot as booked and waits on that booking.
  await db.transaction(async (tx) => {
    await tx
      .delete(bookings)
      .where(eq(bookings.id, theirs.json<CreatedBooking>().id));
    queued = subscribe(TENANT, {date: bookableDate, start: '07:00'});
    await waitUntilBlocked('transactionid');
  });

  const response = await queued;
  assert.equal(response?.statusCode, 409);
  assert.equal(response && codeOf(response), 'SLOT_AVAILABLE');
  assert.deepEqual((await mySubscriptions(TENANT)).json<Subscription[]>(), []);
});

test('signing out ends the session', async () => {
  const {cookie} = await signIn(emailOf(NEIGHBOUR));

  const before = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie},
  });
  assert.equal(before.statusCode, 200);
  assert.equal(
    before.json<{member: {apartment: string}}>().member.apartment,
    NEIGHBOUR,
  );

  const signOut = await server.inject({
    method: 'POST',
    url: '/auth/sign-out',
    headers: {cookie, origin: ORIGIN},
    payload: {},
  });
  assert.equal(signOut.statusCode, 200);

  const after = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie},
  });
  assert.equal(after.statusCode, 401);
});

test('a room offers its own grid and nothing else', async () => {
  const laundry = startsIn(await slotsFor(TENANT, bookableDate, LAUNDRY_1));
  const drying = startsIn(await slotsFor(TENANT, bookableDate, DRYING));

  assert.ok(laundry.includes(ALL_DAY.start));
  assert.ok(!laundry.includes(EVENING.start));
  assert.ok(!laundry.includes(NIGHT.start));

  assert.ok(drying.includes(EVENING.start));
  assert.ok(drying.includes(NIGHT.start));
  assert.ok(!drying.includes(ALL_DAY.start));
});

test('rejects a start the room does not offer', async () => {
  const response = await book(TENANT, {
    date: bookableDate,
    start: EVENING.start,
    resourceId: LAUNDRY_1,
  });

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('lets a kind with room for two take a second booking', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    start: '07:00',
    resourceId: SAUNA,
  });
  const second = await book(TENANT, {
    date: bookableDate,
    start: '10:00',
    resourceId: SAUNA,
  });
  const third = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    resourceId: SAUNA,
  });

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(third.statusCode, 409);
  assert.equal(codeOf(third), 'HAS_ACTIVE_BOOKING');

  const mine = await myBookings(TENANT);
  assert.equal(mine.json<Booking[]>().length, 2);
});

test('a night slot ends the morning after it starts', async () => {
  const response = await book(TENANT, {
    date: bookableDate,
    start: NIGHT.start,
    resourceId: DRYING,
  });
  const created = response.json<CreatedBooking>();

  assert.equal(response.statusCode, 201);
  assert.equal(created.start, NIGHT.start);
  assert.equal(created.end, NIGHT.end);
  assert.equal(created.endsAt.slice(0, 10), dayAfterBookable);
});

test('a range answers for every day in it', async () => {
  const response = await slotsBetween(TENANT, bookableDate, dayAfterBookable);
  const dates = new Set(response.json<Slots>().slots.map((slot) => slot.date));

  assert.equal(response.statusCode, 200);
  assert.deepEqual([...dates].sort(), [bookableDate, dayAfterBookable]);
});

test('a booking in a range marks only its own day', async () => {
  await book(TENANT, {date: bookableDate, start: '07:00'});

  const {slots} = (
    await slotsBetween(TENANT, bookableDate, dayAfterBookable)
  ).json<Slots>();

  const booked = slots.find(
    (slot) => slot.date === bookableDate && slot.start === '07:00',
  );
  const untouched = slots.find(
    (slot) => slot.date === dayAfterBookable && slot.start === '07:00',
  );

  assert.equal(booked?.status, 'mine');
  assert.equal(untouched?.status, 'available');
});

test('a range without to still answers for the single day', async () => {
  const {slots} = (await slotsFor(TENANT, bookableDate)).json<Slots>();

  assert.ok(slots.length > 0);
  assert.ok(slots.every((slot) => slot.date === bookableDate));
});

test('rejects a range that reaches past the booking window', async () => {
  const response = await slotsBetween(TENANT, bookableDate, beyondWindow);

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'OUTSIDE_BOOKING_WINDOW');
});

test('rejects a range that ends before it starts', async () => {
  const response = await slotsBetween(TENANT, dayAfterBookable, bookableDate);

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'VALIDATION');
});

test('a schedule answers for every resource in resource order', async () => {
  const response = await scheduleBetween(
    TENANT,
    bookableDate,
    dayAfterBookable,
  );
  const schedule = response.json<ResourceSchedule[]>();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    schedule.map((entry) => entry.resourceId),
    RESOURCES.map((resource) => resource.id),
  );

  for (const entry of schedule) {
    const dates = new Set(entry.slots.map((slot) => slot.date));
    assert.deepEqual([...dates].sort(), [bookableDate, dayAfterBookable]);
  }
});

test('a schedule matches the slots of each resource', async () => {
  await book(TENANT, {date: bookableDate, start: '07:00'});
  await book(NEIGHBOUR, {date: bookableDate, start: '10:00'});

  const schedule = (
    await scheduleBetween(TENANT, bookableDate, dayAfterBookable)
  ).json<ResourceSchedule[]>();

  for (const resource of RESOURCES) {
    const single = (
      await slotsBetween(TENANT, bookableDate, dayAfterBookable, resource.id)
    ).json<Slots>();
    const entry = schedule.find((item) => item.resourceId === resource.id);

    assert.deepEqual(
      {slots: entry?.slots, held: entry?.held},
      {slots: single.slots, held: single.held},
    );
  }
});

test('a schedule reports the active booking only on its own kind', async () => {
  await book(TENANT, {date: bookableDate, start: '07:00'});

  const schedule = (
    await scheduleBetween(TENANT, bookableDate, bookableDate)
  ).json<ResourceSchedule[]>();
  const heldOn = (id: string) =>
    schedule.find((entry) => entry.resourceId === id)?.held.bookings.length;

  assert.equal(heldOn(LAUNDRY_1), 1);
  assert.equal(heldOn(LAUNDRY_2), 1);
  assert.equal(heldOn(DRYING), 0);
  assert.equal(heldOn(SAUNA), 0);
});

test('rejects a schedule outside the booking window', async () => {
  const past = await scheduleBetween(TENANT, yesterday, bookableDate);
  const beyond = await scheduleBetween(TENANT, bookableDate, beyondWindow);

  assert.equal(codeOf(past), 'OUTSIDE_BOOKING_WINDOW');
  assert.equal(codeOf(beyond), 'OUTSIDE_BOOKING_WINDOW');
});

test('rejects a schedule that ends before it starts', async () => {
  const response = await scheduleBetween(
    TENANT,
    dayAfterBookable,
    bookableDate,
  );

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'VALIDATION');
});

test('booking rules group the resources by kind', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/booking-rules',
    headers: signedInAs(TENANT),
  });
  const rules = response.json<BookingRules>();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    rules.kinds.map((kind) => ({
      id: kind.id,
      maxActive: kind.maxActive,
      resources: kind.resources.map((resource) => resource.id),
    })),
    [
      {id: 'laundry', maxActive: 1, resources: [LAUNDRY_1, LAUNDRY_2]},
      {id: 'drying', maxActive: 1, resources: [DRYING]},
      {id: 'sauna', maxActive: 2, resources: [SAUNA]},
    ],
  );
  assert.deepEqual(
    rules.kinds[1]?.resources[0]?.slots,
    [...DAY_SLOTS, EVENING, NIGHT].map(({start, end}) => ({start, end})),
  );
});
