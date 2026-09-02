import assert from 'node:assert/strict';
import {after, before, beforeEach, test} from 'node:test';

import {sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {bookings, resources, subscriptions, timeSlots} from '../db/schema.js';
import {slotEndsAt, toIsoDate} from '../lib/time.js';
import type {Resource} from '../resource/resource.dto.js';
import type {Slots} from '../slot/slot.dto.js';
import type {Subscription} from '../subscription/subscription.dto.js';
import {listSubscribers} from '../subscription/subscription.service.js';
import type {Booking, CreatedBooking} from './booking.dto.js';

const LAUNDRY_1 = 'laundry-1';
const LAUNDRY_2 = 'laundry-2';
const DRYING = 'drying-room';

const RESOURCES = [
  {
    id: LAUNDRY_1,
    name: 'Tvättstuga 1',
    kind: 'laundry' as const,
    hasDryer: true,
    sortOrder: 1,
  },
  {
    id: LAUNDRY_2,
    name: 'Tvättstuga 2',
    kind: 'laundry' as const,
    hasDryer: false,
    sortOrder: 2,
  },
  {
    id: DRYING,
    name: 'Torkrum',
    kind: 'drying' as const,
    hasDryer: false,
    sortOrder: 3,
  },
];

const TIME_SLOTS = [
  {id: '07-10', start: '07:00', end: '10:00'},
  {id: '10-13', start: '10:00', end: '13:00'},
  {id: '13-16', start: '13:00', end: '16:00'},
  {id: 'all-day', start: '00:00', end: '23:59:59'},
];

const TENANT = '12';
const NEIGHBOUR = '21';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

function dateInDays(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

const bookableDate = dateInDays(3);
const today = dateInDays(0);
const yesterday = dateInDays(-1);
const beyondWindow = dateInDays(40);

let server: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
  const [connection] = (
    await db.execute<{name: string}>(sql`select current_database() as name`)
  ).rows;

  if (!connection?.name.endsWith('_test')) {
    throw new Error(
      `Refusing to run against ${connection?.name ?? 'unknown database'}, expected a _test database`,
    );
  }

  server = await buildApp({logger: false});
  await db.execute(
    sql`truncate resources, time_slots, bookings, subscriptions cascade`,
  );
  await db.insert(resources).values([...RESOURCES]);
  await db.insert(timeSlots).values([...TIME_SLOTS]);
});

beforeEach(async () => {
  await db.execute(sql`truncate bookings, subscriptions cascade`);
});

after(async () => {
  await server.close();
  await pool.end();
});

function book(userId: string, payload: Record<string, unknown>) {
  return server.inject({
    method: 'POST',
    url: '/bookings',
    headers: {'x-apartment-number': userId},
    payload: {resourceId: LAUNDRY_1, ...payload},
  });
}

function myBookings(userId: string) {
  return server.inject({
    method: 'GET',
    url: '/bookings',
    headers: {'x-apartment-number': userId},
  });
}

function cancel(userId: string, id: string) {
  return server.inject({
    method: 'DELETE',
    url: `/bookings/${id}`,
    headers: {'x-apartment-number': userId},
  });
}

function slotsFor(userId: string, date: string, resourceId = LAUNDRY_1) {
  return server.inject({
    method: 'GET',
    url: `/slots?date=${date}&resourceId=${resourceId}`,
    headers: {'x-apartment-number': userId},
  });
}

async function insertStartedBooking(
  userId: string,
  resourceId: string = LAUNDRY_1,
) {
  const [row] = await db
    .insert(bookings)
    .values({
      date: today,
      slotId: 'all-day',
      resourceId,
      userId,
      endsAt: slotEndsAt(today, '23:59:59'),
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
    headers: {'x-apartment-number': userId},
    payload: {resourceId: LAUNDRY_1, ...payload},
  });
}

function mySubscriptions(userId: string) {
  return server.inject({
    method: 'GET',
    url: '/subscriptions',
    headers: {'x-apartment-number': userId},
  });
}

function unsubscribe(userId: string, id: string) {
  return server.inject({
    method: 'DELETE',
    url: `/subscriptions/${id}`,
    headers: {'x-apartment-number': userId},
  });
}

function codeOf(response: {json: <T>() => T}) {
  return response.json<{code: string}>().code;
}

test('books a free slot', async () => {
  const response = await book(TENANT, {date: bookableDate, slotId: '07-10'});
  const created = response.json<CreatedBooking>();

  assert.equal(response.statusCode, 201);
  assert.equal(created.date, bookableDate);
  assert.equal(created.slotId, '07-10');
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
  await book(NEIGHBOUR, {date: bookableDate, slotId: '10-13'});

  const response = await book(TENANT, {date: bookableDate, slotId: '10-13'});

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'SLOT_TAKEN');

  const mine = await myBookings(TENANT);
  assert.deepEqual(mine.json<Booking[]>(), []);
});

test('rejects a second booking for the same apartment', async () => {
  const first = await book(TENANT, {date: bookableDate, slotId: '07-10'});

  const response = await book(TENANT, {date: bookableDate, slotId: '13-16'});

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.id),
    [first.json<CreatedBooking>().id],
  );
});

test('replaces the active booking when replaceExisting is set', async () => {
  const first = await book(TENANT, {date: bookableDate, slotId: '07-10'});

  const response = await book(TENANT, {
    date: bookableDate,
    slotId: '13-16',
    replaceExisting: true,
  });
  const created = response.json<CreatedBooking>();

  assert.equal(response.statusCode, 201);
  assert.equal(created.slotId, '13-16');
  assert.equal(created.replacedId, first.json<CreatedBooking>().id);

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.slotId),
    ['13-16'],
  );
});

test('rejects an unknown slot', async () => {
  const response = await book(TENANT, {date: bookableDate, slotId: '22-25'});

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('rejects a slot that has already ended', async () => {
  const response = await book(TENANT, {date: yesterday, slotId: '07-10'});

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'SLOT_IN_PAST');
});

test('rejects a slot that has already started', async () => {
  const response = await book(TENANT, {date: today, slotId: 'all-day'});

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'SLOT_STARTED');
});

test('rejects a date beyond the booking window', async () => {
  const response = await book(TENANT, {date: beyondWindow, slotId: '07-10'});

  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'OUTSIDE_BOOKING_WINDOW');
});

test('rejects a request without an apartment number', async () => {
  const response = await server.inject({method: 'GET', url: '/bookings'});

  assert.equal(response.statusCode, 401);
  assert.equal(codeOf(response), 'UNAUTHORIZED');
});

test('cancels its own booking', async () => {
  const created = await book(TENANT, {date: bookableDate, slotId: '07-10'});

  const response = await cancel(TENANT, created.json<CreatedBooking>().id);

  assert.equal(response.statusCode, 204);

  const mine = await myBookings(TENANT);
  assert.deepEqual(mine.json<Booking[]>(), []);

  const again = await book(TENANT, {date: bookableDate, slotId: '10-13'});
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
    listed.json<Slots>().slots.find((slot) => slot.id === 'all-day')?.status,
    'walkin',
  );

  const own = await slotsFor(TENANT, today);
  assert.equal(
    own.json<Slots>().slots.find((slot) => slot.id === 'all-day')?.status,
    'walkin',
  );
});

test('rejects a new booking after the apartment opens a started slot', async () => {
  const {id} = await insertStartedBooking(TENANT);
  await cancel(TENANT, id);

  const again = await book(TENANT, {date: bookableDate, slotId: '07-10'});
  assert.equal(again.statusCode, 409);
  assert.equal(codeOf(again), 'HAS_ACTIVE_BOOKING');

  const replace = await book(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    replaceExisting: true,
  });
  assert.equal(replace.statusCode, 409);
  assert.equal(codeOf(replace), 'HAS_ACTIVE_BOOKING');

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.id),
    [id],
  );
});

test('keeps the queue after a drop-in so the subscriber can leave', async () => {
  const {id} = await insertStartedBooking(TENANT);
  await db.insert(subscriptions).values({
    date: today,
    slotId: 'all-day',
    resourceId: LAUNDRY_1,
    userId: NEIGHBOUR,
    endsAt: slotEndsAt(today, '23:59:59'),
  });

  await cancel(TENANT, id);

  const queued = await mySubscriptions(NEIGHBOUR);
  const [held] = queued.json<Subscription[]>();
  assert.equal(held?.available, true);
  assert.equal(held?.started, true);

  const take = await book(NEIGHBOUR, {date: today, slotId: 'all-day'});
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
    slotId: '07-10',
  });

  const response = await cancel(TENANT, created.json<CreatedBooking>().id);

  assert.equal(response.statusCode, 403);
  assert.equal(codeOf(response), 'FORBIDDEN');

  const theirs = await myBookings(NEIGHBOUR);
  assert.equal(theirs.json<Booking[]>().length, 1);
});

test('rejects cancelling an unknown booking', async () => {
  const response = await cancel(TENANT, UNKNOWN_ID);

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('lets only one apartment take a slot when several book at once', async () => {
  const apartments = ['11', '12', '13', '14', '15'];

  const responses = await Promise.all(
    apartments.map((apartment) =>
      book(apartment, {date: bookableDate, slotId: '07-10'}),
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
    ['07-10', '10-13', '13-16'].map((slotId) =>
      book(TENANT, {date: bookableDate, slotId}),
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
  const theirs = await book(NEIGHBOUR, {date: bookableDate, slotId: '07-10'});
  await subscribe(TENANT, {date: bookableDate, slotId: '07-10'});

  await cancel(NEIGHBOUR, theirs.json<CreatedBooking>().id);

  const queued = await mySubscriptions(TENANT);
  assert.deepEqual(
    queued.json<Subscription[]>().map((subscription) => subscription.available),
    [true],
  );

  const response = await book(TENANT, {date: bookableDate, slotId: '07-10'});

  assert.equal(response.statusCode, 201);

  const afterBooking = await mySubscriptions(TENANT);
  assert.deepEqual(afterBooking.json<Subscription[]>(), []);

  const mine = await myBookings(TENANT);
  assert.deepEqual(
    mine.json<Booking[]>().map((booking) => booking.slotId),
    ['07-10'],
  );
});

test('lists bookable resources', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/resources',
    headers: {'x-apartment-number': TENANT},
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    response.json<Resource[]>().map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      hasDryer: resource.hasDryer,
    })),
    [
      {id: LAUNDRY_1, kind: 'laundry', hasDryer: true},
      {id: LAUNDRY_2, kind: 'laundry', hasDryer: false},
      {id: DRYING, kind: 'drying', hasDryer: false},
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
    slotId: '07-10',
    resourceId: 'nope',
  });

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
});

test('lets two apartments book the same slot in different laundry rooms', async () => {
  const first = await book(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });
  const second = await book(NEIGHBOUR, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_2,
  });

  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);

  const laundry1 = await slotsFor(TENANT, bookableDate, LAUNDRY_1);
  const laundry2 = await slotsFor(NEIGHBOUR, bookableDate, LAUNDRY_2);

  assert.equal(
    laundry1.json<Slots>().slots.find((slot) => slot.id === '07-10')?.status,
    'mine',
  );
  assert.equal(
    laundry2.json<Slots>().slots.find((slot) => slot.id === '07-10')?.status,
    'mine',
  );
});

test('rejects a second laundry booking even in the other room', async () => {
  await book(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });

  const response = await book(TENANT, {
    date: bookableDate,
    slotId: '13-16',
    resourceId: LAUNDRY_2,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
});

test('lets an apartment book laundry and drying at the same time', async () => {
  const laundry = await book(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });
  const drying = await book(TENANT, {
    date: bookableDate,
    slotId: '10-13',
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
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });
  await book(TENANT, {
    date: bookableDate,
    slotId: '10-13',
    resourceId: DRYING,
  });

  const swapped = await book(TENANT, {
    date: bookableDate,
    slotId: '13-16',
    resourceId: LAUNDRY_2,
    replaceExisting: true,
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
      .map((booking) => `${booking.resourceId}:${booking.slotId}`)
      .sort(),
    [`${DRYING}:10-13`, `${LAUNDRY_2}:13-16`].sort(),
  );
});

test('rejects a second drying booking', async () => {
  await book(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: DRYING,
  });

  const response = await book(TENANT, {
    date: bookableDate,
    slotId: '13-16',
    resourceId: DRYING,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
});

test('keeps the laundry queue off the other room', async () => {
  await book(NEIGHBOUR, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });
  await subscribe(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });

  const otherRoom = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.equal(
    otherRoom.json<Slots>().slots.find((slot) => slot.id === '07-10')?.status,
    'available',
  );

  const queued = await slotsFor(TENANT, bookableDate, LAUNDRY_1);
  const slot = queued.json<Slots>().slots.find((item) => item.id === '07-10');
  assert.equal(slot?.status, 'booked');
  assert.ok(slot?.status === 'booked' && slot.subscriptionId);
});

test('slots report the active booking of the same kind', async () => {
  const before = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.equal(before.json<Slots>().active, null);

  await book(TENANT, {date: bookableDate, slotId: '07-10'});

  const sameKind = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.deepEqual(sameKind.json<Slots>().active, {released: false});

  const otherKind = await slotsFor(TENANT, bookableDate, DRYING);
  assert.equal(otherKind.json<Slots>().active, null);
});

test('slots report a released booking as still active', async () => {
  const {id} = await insertStartedBooking(TENANT);
  await cancel(TENANT, id);

  const listed = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.deepEqual(listed.json<Slots>().active, {released: true});
});

test('a started booking in one room does not occupy the other', async () => {
  await insertStartedBooking(TENANT, LAUNDRY_1);

  const other = await slotsFor(NEIGHBOUR, today, LAUNDRY_2);
  assert.equal(
    other.json<Slots>().slots.find((slot) => slot.id === 'all-day')?.status,
    'walkin',
  );

  const ownOther = await slotsFor(TENANT, today, LAUNDRY_2);
  assert.equal(
    ownOther.json<Slots>().slots.find((slot) => slot.id === 'all-day')?.status,
    'walkin',
  );
});

test('cancelling one room does not free a queue on the other', async () => {
  const first = await book(NEIGHBOUR, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });
  await book('14', {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_2,
  });
  await subscribe(TENANT, {
    date: bookableDate,
    slotId: '07-10',
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
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });
  await book('14', {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_2,
  });
  await subscribe(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_1,
  });

  const laundry1 = await listSubscribers(LAUNDRY_1, bookableDate, '07-10');
  const laundry2 = await listSubscribers(LAUNDRY_2, bookableDate, '07-10');

  assert.deepEqual(
    laundry1.map((row) => row.userId),
    [TENANT],
  );
  assert.deepEqual(laundry2, []);
});

test('releasing a started laundry booking still blocks the other laundry room', async () => {
  const {id} = await insertStartedBooking(TENANT, LAUNDRY_1);
  await cancel(TENANT, id);

  const response = await book(TENANT, {
    date: bookableDate,
    slotId: '07-10',
    resourceId: LAUNDRY_2,
  });

  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'HAS_ACTIVE_BOOKING');
});
