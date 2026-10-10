import assert from 'node:assert/strict';
import {after, before, beforeEach, test} from 'node:test';

import {sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {bookings, pushTokens, subscriptions} from '../db/schema.js';
import {addDays, isoDateIn, slotEndsAt} from '../lib/time.js';
import type {BookingRules, Resource} from '../resource/resource.dto.js';
import type {ResourceSchedule, Slots} from '../slot/slot.dto.js';
import type {Subscription} from '../subscription/subscription.dto.js';
import {listSubscribers} from '../subscription/subscription.service.js';
import {
  assertTestDatabase,
  codeOf,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  seedOrganization,
  signIn as signInTo,
} from '../test/fixtures.js';
import type {Booking, CreatedBooking} from './booking.dto.js';

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
  {id: 'laundry', name: 'Tvätt', maxActive: 1},
  {id: 'drying', name: 'Tork', maxActive: 1},
  {id: 'sauna', name: 'Bastu', maxActive: 2},
];

const APARTMENTS = ['11', '12', '13', '14', '15', '21', '31'];

const RESOURCES = [
  {
    id: LAUNDRY_1,
    kindId: 'laundry',
    name: 'Tvättstuga 1',
    tags: ['torktumlare'],
    sortOrder: 1,
  },
  {
    id: LAUNDRY_2,
    kindId: 'laundry',
    name: 'Tvättstuga 2',
    tags: [],
    sortOrder: 2,
  },
  {
    id: DRYING,
    kindId: 'drying',
    name: 'Torkrum',
    tags: ['avfuktare'],
    sortOrder: 3,
  },
  {
    id: SAUNA,
    kindId: 'sauna',
    name: 'Bastu',
    tags: [],
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
const cookies = new Map<string, string>();

function emailOf(label: string) {
  return `${label}@example.com`;
}

function signIn(email: string, password = PASSWORD) {
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

  server = await buildApp({logger: false});
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

test('replaces the active booking when replaceExisting is set', async () => {
  const first = await book(TENANT, {date: bookableDate, start: '07:00'});

  const response = await book(TENANT, {
    date: bookableDate,
    start: '13:00',
    replaceExisting: true,
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

test('rejects cancelling an unknown booking', async () => {
  const response = await cancel(TENANT, UNKNOWN_ID);

  assert.equal(response.statusCode, 404);
  assert.equal(codeOf(response), 'NOT_FOUND');
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

test('slots report the active booking of the same kind', async () => {
  const before = await slotsFor(TENANT, bookableDate, LAUNDRY_2);
  assert.equal(before.json<Slots>().active, null);

  await book(TENANT, {date: bookableDate, start: '07:00'});

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

test('rejects a wrong password and a forged cookie', async () => {
  const {response} = await signIn(emailOf(TENANT), 'wrong');
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
    {token: mine, memberId: memberId(TENANT)},
    {token: theirs, memberId: memberId(NEIGHBOUR)},
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

test('signing out ends the session', async () => {
  const {cookie} = await signIn(emailOf(NEIGHBOUR));

  const before = await server.inject({
    method: 'GET',
    url: '/account',
    headers: {cookie},
  });
  assert.equal(before.statusCode, 200);
  assert.equal(before.json<{apartment: string}>().apartment, NEIGHBOUR);

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
      {slots: entry?.slots, active: entry?.active},
      {slots: single.slots, active: single.active},
    );
  }
});

test('a schedule reports the active booking only on its own kind', async () => {
  await book(TENANT, {date: bookableDate, start: '07:00'});

  const schedule = (
    await scheduleBetween(TENANT, bookableDate, bookableDate)
  ).json<ResourceSchedule[]>();
  const activeOf = (id: string) =>
    schedule.find((entry) => entry.resourceId === id)?.active;

  assert.deepEqual(activeOf(LAUNDRY_1), {released: false});
  assert.deepEqual(activeOf(LAUNDRY_2), {released: false});
  assert.equal(activeOf(DRYING), null);
  assert.equal(activeOf(SAUNA), null);
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
