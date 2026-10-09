import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {eq} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {resources} from '../db/schema.js';
import type {BookingRules, Resource} from '../resource/resource.dto.js';
import type {BookingWindow, Slots} from '../slot/slot.dto.js';
import {
  assertTestDatabase,
  codeOf,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';
import type {AdminResources} from './resourceAdmin.dto.js';

const NORTH = {id: 'north', name: 'Brf Norr', bookingWindowDays: 10};
const SOUTH = {id: 'south', name: 'Brf Söder', bookingWindowDays: 10};
const LAUNDRY = 'north-laundry';

let server: Awaited<ReturnType<typeof buildApp>>;
let admin: {cookie: string};
let southAdmin: {cookie: string};
let member: {cookie: string};

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  headers: {cookie: string},
  payload?: unknown,
) {
  return server.inject({
    method,
    url,
    headers,
    payload: payload as Record<string, unknown> | undefined,
  });
}

async function adminView(headers = admin) {
  return (
    await call('GET', '/admin/resources', headers)
  ).json<AdminResources>();
}

async function startsOn(date: string, resourceId = LAUNDRY) {
  const response = await call(
    'GET',
    `/slots?date=${date}&resourceId=${resourceId}`,
    member,
  );
  return response.json<Slots>().slots.map((slot) => slot.start);
}

const slot = (start: string, end: string, endOffsetDays: 0 | 1 = 0) => ({
  start,
  end,
  endOffsetDays,
});

before(async () => {
  await assertTestDatabase();

  server = await buildApp({logger: false});
  await resetDatabase();

  await seedOrganization({
    organization: NORTH,
    kinds: [{id: 'laundry', name: 'Tvätt', maxActive: 1}],
    resources: [
      {
        id: LAUNDRY,
        kindId: 'laundry',
        name: 'Tvättstuga',
        tags: [],
        sortOrder: 1,
      },
    ],
    slots: [
      {resourceId: LAUNDRY, start: '08:00', end: '12:00'},
      {resourceId: LAUNDRY, start: '12:00', end: '16:00'},
    ],
    apartments: ['1'],
    emailOf: (label) => `${label}@north.example.com`,
    adminEmail: 'admin@north.example.com',
  });
  await seedOrganization({
    organization: SOUTH,
    kinds: [],
    resources: [],
    slots: [],
    apartments: [],
    emailOf: (label) => label,
    adminEmail: 'admin@south.example.com',
  });

  admin = {cookie: (await signIn(server, 'admin@north.example.com')).cookie};
  southAdmin = {
    cookie: (await signIn(server, 'admin@south.example.com')).cookie,
  };
  member = {cookie: (await signIn(server, '1@north.example.com')).cookie};
});

after(async () => {
  await server.close();
  await pool.end();
});

test('a change starts the day after the booking window at the earliest', async () => {
  const {today, earliestChange} = await adminView();
  assert.equal(earliestChange, addDays(today, NORTH.bookingWindowDays + 1));

  const inside = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {validFrom: addDays(earliestChange, -1), slots: [slot('09:00', '13:00')]},
  );
  assert.equal(inside.statusCode, 400);
  assert.equal(codeOf(inside), 'CHANGE_INSIDE_WINDOW');
});

test('a new schedule is booked from its first day and not before', async () => {
  const {earliestChange} = await adminView();

  const response = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {
      validFrom: earliestChange,
      slots: [slot('07:00', '10:00'), slot('10:00', '13:00')],
    },
  );
  assert.equal(response.statusCode, 204);

  const view = await adminView();
  const laundry = view.resources.find((resource) => resource.id === LAUNDRY);
  assert.deepEqual(
    laundry?.schedules.map((schedule) => schedule.validFrom),
    ['2000-01-01', earliestChange],
  );

  // The member's window ends the day before, so they still book the old
  // slots there; the server serves the new ones once the window reaches it.
  const window = (
    await call('GET', '/booking-window', member)
  ).json<BookingWindow>();
  assert.deepEqual(await startsOn(window.to), ['08:00', '12:00']);

  const rules = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  const ruled = rules.kinds[0]?.resources[0];
  assert.deepEqual(ruled?.slots, [
    {start: '08:00', end: '12:00'},
    {start: '12:00', end: '16:00'},
  ]);
  assert.deepEqual(ruled?.changes, [
    {
      validFrom: earliestChange,
      slots: [
        {start: '07:00', end: '10:00'},
        {start: '10:00', end: '13:00'},
      ],
    },
  ]);
});

test('setting up a change again replaces the one not yet in reach', async () => {
  const {earliestChange} = await adminView();

  await call('PUT', `/admin/resources/${LAUNDRY}/schedule`, admin, {
    validFrom: addDays(earliestChange, 3),
    slots: [slot('06:00', '09:00')],
  });

  const laundry = (await adminView()).resources.find(
    (resource) => resource.id === LAUNDRY,
  );
  assert.deepEqual(
    laundry?.schedules.map((schedule) => schedule.validFrom),
    ['2000-01-01', addDays(earliestChange, 3)],
  );

  const removed = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${addDays(earliestChange, 3)}`,
    admin,
  );
  assert.equal(removed.statusCode, 204);
  const after = (await adminView()).resources.find(
    (resource) => resource.id === LAUNDRY,
  );
  assert.equal(after?.schedules.length, 1);
});

test('refuses slots that overlap or end before they start', async () => {
  const {earliestChange} = await adminView();
  const cases = [
    [slot('08:00', '12:00'), slot('11:00', '14:00')],
    [slot('12:00', '10:00')],
    [slot('08:00', '12:00'), slot('20:00', '09:00', 1)],
    [slot('08:00', '12:00'), slot('08:00', '10:00')],
  ];

  for (const slots of cases) {
    const response = await call(
      'PUT',
      `/admin/resources/${LAUNDRY}/schedule`,
      admin,
      {validFrom: earliestChange, slots},
    );
    assert.equal(response.statusCode, 400, JSON.stringify(slots));
    assert.equal(codeOf(response), 'INVALID_SCHEDULE');
  }

  const overnight = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {
      validFrom: earliestChange,
      slots: [slot('08:00', '20:00'), slot('20:00', '08:00', 1)],
    },
  );
  assert.equal(overnight.statusCode, 204);
  await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${earliestChange}`,
    admin,
  );
});

test('a new resource of a new kind can be booked today', async () => {
  const kind = await call('POST', '/admin/kinds', admin, {
    name: 'Bastu',
    maxActive: 2,
  });
  assert.equal(kind.statusCode, 201);
  const kindId = kind.json<{id: string}>().id;

  const created = await call('POST', '/admin/resources', admin, {
    name: 'Bastun',
    kindId,
    tags: ['max 4 personer'],
    slots: [slot('22:00', '23:30')],
  });
  assert.equal(created.statusCode, 201);
  const id = created.json<{id: string}>().id;

  const listed = (await call('GET', '/resources', member)).json<Resource[]>();
  assert.deepEqual(
    listed.map((resource) => resource.name),
    ['Tvättstuga', 'Bastun'],
  );

  const window = (
    await call('GET', '/booking-window', member)
  ).json<BookingWindow>();
  assert.deepEqual(await startsOn(window.to, id), ['22:00']);

  const inUse = await call('DELETE', `/admin/kinds/${kindId}`, admin);
  assert.equal(inUse.statusCode, 409);
  assert.equal(codeOf(inUse), 'KIND_IN_USE');

  const order = await call('PUT', '/admin/resources/order', admin, {
    ids: [id, LAUNDRY],
  });
  assert.equal(order.statusCode, 204);
  const reordered = (await call('GET', '/resources', member)).json<
    Resource[]
  >();
  assert.deepEqual(
    reordered.map((resource) => resource.name),
    ['Bastun', 'Tvättstuga'],
  );
});

test('a closed resource stops taking bookings from its closing day', async () => {
  const {earliestChange} = await adminView();

  const inside = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
    {
      closesFrom: addDays(earliestChange, -1),
    },
  );
  assert.equal(codeOf(inside), 'CHANGE_INSIDE_WINDOW');

  const closing = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
    {closesFrom: earliestChange},
  );
  assert.equal(closing.statusCode, 204);

  const rules = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  assert.equal(
    rules.kinds
      .flatMap((kind) => kind.resources)
      .find((resource) => resource.id === LAUNDRY)?.closesFrom,
    earliestChange,
  );

  // Once the day has come the resource is gone for members.
  const {today} = await adminView();
  await db
    .update(resources)
    .set({closesFrom: today})
    .where(eq(resources.id, LAUNDRY));
  const listed = (await call('GET', '/resources', member)).json<Resource[]>();
  assert.ok(!listed.some((resource) => resource.id === LAUNDRY));

  const reopened = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
  );
  assert.equal(reopened.statusCode, 204);
  const back = (await call('GET', '/resources', member)).json<Resource[]>();
  assert.ok(back.some((resource) => resource.id === LAUNDRY));
});

test("an admin cannot touch another organization's resources", async () => {
  const {earliestChange} = await adminView();
  const requests = [
    call('PATCH', `/admin/resources/${LAUNDRY}`, southAdmin, {name: 'Min'}),
    call('PUT', `/admin/resources/${LAUNDRY}/schedule`, southAdmin, {
      validFrom: earliestChange,
      slots: [slot('08:00', '09:00')],
    }),
    call('PUT', `/admin/resources/${LAUNDRY}/closing`, southAdmin, {
      closesFrom: earliestChange,
    }),
    call('PATCH', '/admin/kinds/laundry', southAdmin, {maxActive: 5}),
  ];

  for (const [index, response] of (await Promise.all(requests)).entries()) {
    assert.equal(response.statusCode, 404, `request ${index}`);
  }

  assert.deepEqual((await adminView(southAdmin)).resources, []);
});

test('the window length changes at once', async () => {
  const response = await call('PATCH', '/admin/organization', admin, {
    bookingWindowDays: 14,
  });
  assert.equal(response.statusCode, 200);

  const window = (
    await call('GET', '/booking-window', member)
  ).json<BookingWindow>();
  assert.equal(window.to, addDays(window.today, 14));
});
