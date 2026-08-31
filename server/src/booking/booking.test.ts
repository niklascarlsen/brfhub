import assert from 'node:assert/strict';
import {after, before, beforeEach, test} from 'node:test';

import {sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {slotEndsAt, toIsoDate} from '../lib/time.js';
import type {Slot} from '../slot/slot.dto.js';
import type {Subscription} from '../subscription/subscription.dto.js';
import type {Booking, CreatedBooking} from './booking.dto.js';

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
  await db.execute(sql`truncate time_slots, bookings, subscriptions cascade`);
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
    payload,
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

function slotsFor(userId: string, date: string) {
  return server.inject({
    method: 'GET',
    url: `/slots?date=${date}`,
    headers: {'x-apartment-number': userId},
  });
}

async function insertStartedBooking(userId: string) {
  const [row] = await db
    .insert(bookings)
    .values({
      date: today,
      slotId: 'all-day',
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
    payload,
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
    listed.json<Slot[]>().find((slot) => slot.id === 'all-day')?.status,
    'walkin',
  );

  const own = await slotsFor(TENANT, today);
  assert.equal(
    own.json<Slot[]>().find((slot) => slot.id === 'all-day')?.status,
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
