import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {and, eq, sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {bookings, resourceSlots} from '../db/schema.js';
import type {AdminEvent} from '../event/event.dto.js';
import {addDays, formatWhen} from '../lib/time.js';
import type {BookingRules, Resource} from '../resource/resource.dto.js';
import type {BookingWindow, Slots} from '../slot/slot.dto.js';
import {
  assertTestDatabase,
  codeOf,
  memoryMail,
  memoryPush,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';
import type {AdminResources, ChangePreview} from './resourceAdmin.dto.js';

const NORTH = {
  id: 'north',
  name: 'Brf Norr',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 10,
};
const SOUTH = {
  id: 'south',
  name: 'Brf Söder',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 10,
};
const LAUNDRY = 'north-laundry';

let server: Awaited<ReturnType<typeof buildApp>>;
let admin: {cookie: string};
let southAdmin: {cookie: string};
let member: {cookie: string};
let neighbour: {cookie: string};
let push: ReturnType<typeof memoryPush>;
let mail: ReturnType<typeof memoryMail>;
let apartmentIds: Map<string, string>;

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

async function laundry(headers = admin) {
  const view = await adminView(headers);
  const found = view.resources.find((resource) => resource.id === LAUNDRY);
  assert.ok(found);
  return {today: view.today, ...found};
}

async function tomorrow() {
  return addDays((await adminView()).today, 1);
}

async function book(
  headers: {cookie: string},
  date: string,
  start: string,
  resourceId = LAUNDRY,
) {
  const response = await call('POST', '/bookings', headers, {
    resourceId,
    date,
    start,
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<{id: string}>().id;
}

async function preview(change: Record<string, unknown>, id = LAUNDRY) {
  const response = await call(
    'POST',
    `/admin/resources/${id}/preview`,
    admin,
    change,
  );
  assert.equal(response.statusCode, 200, response.body);
  return response.json<ChangePreview>().cancels;
}

async function bookingIds() {
  const rows = await db
    .select({id: bookings.id})
    .from(bookings)
    .where(eq(bookings.resourceId, LAUNDRY));
  return rows.map((row) => row.id).sort();
}

async function lastEvent() {
  const events = (await call('GET', '/admin/events', admin)).json<
    AdminEvent[]
  >();
  return events[0];
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

  push = memoryPush();
  mail = memoryMail();
  server = await buildApp({logger: false, push, mail: mail.send});
  await resetDatabase();

  apartmentIds = await seedOrganization({
    organization: NORTH,
    kinds: [{id: 'laundry', name: {sv: 'Tvätt'}, maxActive: 1}],
    resources: [
      {
        id: LAUNDRY,
        kindId: 'laundry',
        name: {sv: 'Tvättstuga'},
        tags: {},
        sortOrder: 1,
      },
    ],
    slots: [
      {resourceId: LAUNDRY, start: '08:00', end: '12:00'},
      {resourceId: LAUNDRY, start: '12:00', end: '16:00'},
    ],
    apartments: ['1', '2'],
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
  neighbour = {cookie: (await signIn(server, '2@north.example.com')).cookie};
});

after(async () => {
  await server.close();
  await pool.end();
});

test('new times start tomorrow at the earliest, a closing today', async () => {
  const {today} = await adminView();

  const schedule = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {validFrom: today, slots: [slot('09:00', '13:00')]},
  );
  assert.equal(schedule.statusCode, 400);
  assert.equal(codeOf(schedule), 'CHANGE_TOO_EARLY');

  const closing = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
    {closesFrom: addDays(today, -1)},
  );
  assert.equal(closing.statusCode, 400);
  assert.equal(codeOf(closing), 'CHANGE_TOO_EARLY');
});

test('a new schedule is booked from its first day and not before', async () => {
  const {today} = await adminView();
  const validFrom = addDays(today, 3);

  const response = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {validFrom, slots: [slot('07:00', '10:00'), slot('10:00', '13:00')]},
  );
  assert.equal(response.statusCode, 204);

  assert.deepEqual(
    (await laundry()).schedules.map((schedule) => schedule.validFrom),
    ['2000-01-01', validFrom],
  );
  assert.deepEqual(await startsOn(addDays(validFrom, -1)), ['08:00', '12:00']);
  assert.deepEqual(await startsOn(validFrom), ['07:00', '10:00']);

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
      validFrom,
      slots: [
        {start: '07:00', end: '10:00'},
        {start: '10:00', end: '13:00'},
      ],
    },
  ]);

  await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${validFrom}`,
    admin,
  );
});

test('new times replace every version from their first day on', async () => {
  const {today} = await adminView();
  const put = (days: number, only: ReturnType<typeof slot>) =>
    call('PUT', `/admin/resources/${LAUNDRY}/schedule`, admin, {
      validFrom: addDays(today, days),
      slots: [only],
    });

  await put(3, slot('06:00', '09:00'));
  await put(5, slot('07:00', '09:00'));
  assert.deepEqual(
    (await laundry()).schedules.map((schedule) => schedule.validFrom),
    ['2000-01-01', addDays(today, 3), addDays(today, 5)],
  );

  await put(2, slot('08:00', '09:00'));
  assert.deepEqual(
    (await laundry()).schedules.map((schedule) => schedule.validFrom),
    ['2000-01-01', addDays(today, 2)],
  );

  const removed = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${addDays(today, 2)}`,
    admin,
  );
  assert.equal(removed.statusCode, 204);
  assert.equal((await laundry()).schedules.length, 1);
});

test('refuses slots that overlap or end before they start', async () => {
  const validFrom = await tomorrow();
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
      {validFrom, slots},
    );
    assert.equal(response.statusCode, 400, JSON.stringify(slots));
    assert.equal(codeOf(response), 'INVALID_SCHEDULE');
  }

  const overnight = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {validFrom, slots: [slot('08:00', '20:00'), slot('20:00', '08:00', 1)]},
  );
  assert.equal(overnight.statusCode, 204);
  await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${validFrom}`,
    admin,
  );
});

test('a new resource of a new kind can be booked today', async () => {
  const kind = await call('POST', '/admin/kinds', admin, {
    name: {sv: 'Bastu'},
    maxActive: 2,
  });
  assert.equal(kind.statusCode, 201);
  const kindId = kind.json<{id: string}>().id;

  const created = await call('POST', '/admin/resources', admin, {
    name: {sv: 'Bastun'},
    kindId,
    tags: {sv: ['max 4 personer']},
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

test('a closed resource stays in sight with what the admin says, until it opens', async () => {
  const {today} = await adminView();

  const closing = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
    {closesFrom: addDays(today, 2)},
  );
  assert.equal(closing.statusCode, 204);

  const rules = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  assert.equal(
    rules.kinds
      .flatMap((kind) => kind.resources)
      .find((resource) => resource.id === LAUNDRY)?.closesFrom,
    addDays(today, 2),
  );

  // A note in a language the organization does not use is refused.
  const untranslated = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
    {closesFrom: today, reason: {en: 'Broken'}},
  );
  assert.equal(codeOf(untranslated), 'LANGUAGES_CHANGED');

  // Closed from today, the resource stays with its note and nothing to
  // book.
  const now = await call('PUT', `/admin/resources/${LAUNDRY}/closing`, admin, {
    closesFrom: today,
    reason: {sv: 'Maskinen är trasig'},
  });
  assert.equal(now.statusCode, 204);
  const listed = (await call('GET', '/resources', member)).json<Resource[]>();
  assert.deepEqual(
    listed.find((resource) => resource.id === LAUNDRY),
    {
      id: LAUNDRY,
      name: 'Tvättstuga',
      kind: 'laundry',
      tags: [],
      closed: true,
      closingNote: 'Maskinen är trasig',
    },
  );
  assert.deepEqual(await startsOn(today), []);
  const ruled = (await call('GET', '/booking-rules', member))
    .json<BookingRules>()
    .kinds.flatMap((kind) => kind.resources)
    .find((resource) => resource.id === LAUNDRY);
  assert.equal(ruled?.closed, true);
  assert.equal(ruled?.closingNote, 'Maskinen är trasig');
  assert.deepEqual((await laundry()).closingNote, {sv: 'Maskinen är trasig'});

  const reopened = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
  );
  assert.equal(reopened.statusCode, 204);
  const back = (await call('GET', '/resources', member)).json<Resource[]>();
  assert.deepEqual(
    back.find((resource) => resource.id === LAUNDRY),
    {
      id: LAUNDRY,
      name: 'Tvättstuga',
      kind: 'laundry',
      tags: [],
      closed: false,
      closingNote: '',
    },
  );
});

test("an admin cannot touch another organization's resources", async () => {
  const day = await tomorrow();
  const requests = [
    call('PATCH', `/admin/resources/${LAUNDRY}`, southAdmin, {
      name: {sv: 'Min'},
    }),
    call('POST', `/admin/resources/${LAUNDRY}/preview`, southAdmin, {
      change: 'closing',
      closesFrom: day,
    }),
    call('PUT', `/admin/resources/${LAUNDRY}/schedule`, southAdmin, {
      validFrom: day,
      slots: [slot('08:00', '09:00')],
    }),
    call('PUT', `/admin/resources/${LAUNDRY}/closing`, southAdmin, {
      closesFrom: day,
    }),
    call('DELETE', `/admin/resources/${LAUNDRY}/closing`, southAdmin),
    call('DELETE', `/admin/resources/${LAUNDRY}/schedule/${day}`, southAdmin),
    call('DELETE', `/admin/resources/${LAUNDRY}`, southAdmin),
    call('PATCH', '/admin/kinds/laundry', southAdmin, {maxActive: 5}),
    call('DELETE', '/admin/kinds/laundry', southAdmin),
  ];

  for (const [index, response] of (await Promise.all(requests)).entries()) {
    assert.equal(response.statusCode, 404, `request ${index}`);
  }

  const order = await call('PUT', '/admin/resources/order', southAdmin, {
    ids: [LAUNDRY],
  });
  assert.equal(order.statusCode, 400);
  assert.equal(codeOf(order), 'VALIDATION');

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

test('an apartment cannot use what only the admin uses', async () => {
  const day = await tomorrow();
  const requests: [
    'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    string,
    Record<string, unknown>?,
  ][] = [
    ['GET', '/admin/resources'],
    ['GET', '/admin/organization'],
    ['PATCH', '/admin/organization', {bookingWindowDays: 60}],
    ['POST', '/admin/kinds', {name: {sv: 'Gästrum'}, maxActive: 1}],
    ['PATCH', '/admin/kinds/laundry', {maxActive: 5}],
    ['DELETE', '/admin/kinds/laundry'],
    [
      'POST',
      '/admin/resources',
      {
        name: {sv: 'Gästrum'},
        kindId: 'laundry',
        tags: {},
        slots: [slot('08:00', '09:00')],
      },
    ],
    ['PATCH', `/admin/resources/${LAUNDRY}`, {name: {sv: 'Min'}}],
    ['PUT', '/admin/resources/order', {ids: [LAUNDRY]}],
    [
      'POST',
      `/admin/resources/${LAUNDRY}/preview`,
      {change: 'closing', closesFrom: day},
    ],
    [
      'PUT',
      `/admin/resources/${LAUNDRY}/schedule`,
      {validFrom: day, slots: [slot('08:00', '09:00')]},
    ],
    ['DELETE', `/admin/resources/${LAUNDRY}/schedule/${day}`],
    ['PUT', `/admin/resources/${LAUNDRY}/closing`, {closesFrom: day}],
    ['DELETE', `/admin/resources/${LAUNDRY}/closing`],
    ['DELETE', `/admin/resources/${LAUNDRY}`],
  ];

  for (const [method, url, payload] of requests) {
    const response = await call(method, url, member, payload);
    assert.equal(response.statusCode, 403, `${method} ${url}`);
    assert.equal(codeOf(response), 'FORBIDDEN', `${method} ${url}`);
  }
});

test('the order must list every resource once', async () => {
  const listed = (await adminView()).resources.map((resource) => resource.id);

  for (const ids of [listed.slice(1), [...listed, listed[0]]]) {
    const response = await call('PUT', '/admin/resources/order', admin, {
      ids,
    });
    assert.equal(response.statusCode, 400, JSON.stringify(ids));
    assert.equal(codeOf(response), 'VALIDATION');
  }
});

test('removes a kind no resource uses', async () => {
  const kind = await call('POST', '/admin/kinds', admin, {
    name: {sv: 'Gästrum'},
    maxActive: 1,
  });
  const id = kind.json<{id: string}>().id;

  const removed = await call('DELETE', `/admin/kinds/${id}`, admin);
  assert.equal(removed.statusCode, 204);
  assert.ok(!(await adminView()).kinds.some((entry) => entry.id === id));
});

test('a schedule in effect cannot be removed', async () => {
  const response = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/2000-01-01`,
    admin,
  );
  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'CHANGE_TOO_EARLY');
});

test('a closing still ahead can be undone', async () => {
  await call('PUT', `/admin/resources/${LAUNDRY}/closing`, admin, {
    closesFrom: await tomorrow(),
  });

  const undone = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
  );
  assert.equal(undone.statusCode, 204);
  assert.equal((await laundry()).closesFrom, null);
});

// A night slot already bookable ends on the first day of the change.
test('a night slot may not run into the first slot of the next schedule', async () => {
  await db.insert(resourceSlots).values({
    resourceId: LAUNDRY,
    validFrom: '2000-01-01',
    start: '20:00',
    end: '07:00',
    endOffsetDays: 1,
  });
  const validFrom = await tomorrow();

  try {
    const overlapping = await call(
      'PUT',
      `/admin/resources/${LAUNDRY}/schedule`,
      admin,
      {validFrom, slots: [slot('06:00', '10:00')]},
    );
    assert.equal(overlapping.statusCode, 400);
    assert.equal(codeOf(overlapping), 'INVALID_SCHEDULE');

    const after = await call(
      'PUT',
      `/admin/resources/${LAUNDRY}/schedule`,
      admin,
      {validFrom, slots: [slot('07:00', '10:00')]},
    );
    assert.equal(after.statusCode, 204);

    // Nor may the night slot of the version that takes over when the
    // change before a later one is removed.
    const later = addDays(validFrom, 2);
    const early = await call(
      'PUT',
      `/admin/resources/${LAUNDRY}/schedule`,
      admin,
      {validFrom: later, slots: [slot('06:00', '10:00')]},
    );
    assert.equal(early.statusCode, 204);
    const uncovered = await call(
      'DELETE',
      `/admin/resources/${LAUNDRY}/schedule/${validFrom}`,
      admin,
    );
    assert.equal(uncovered.statusCode, 400);
    assert.equal(codeOf(uncovered), 'INVALID_SCHEDULE');
  } finally {
    await db
      .delete(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, LAUNDRY),
          sql`${resourceSlots.validFrom} > '2000-01-01'`,
        ),
      );
    await db
      .delete(resourceSlots)
      .where(
        and(
          eq(resourceSlots.resourceId, LAUNDRY),
          eq(resourceSlots.start, '20:00'),
        ),
      );
  }
});

test('two changes at once leave one schedule ahead', async () => {
  const validFrom = await tomorrow();

  const responses = await Promise.all(
    [slot('07:00', '09:00'), slot('09:00', '11:00')].map((only) =>
      call('PUT', `/admin/resources/${LAUNDRY}/schedule`, admin, {
        validFrom,
        slots: [only],
      }),
    ),
  );
  assert.deepEqual(
    responses.map((response) => response.statusCode),
    [204, 204],
  );

  const {schedules} = await laundry();
  assert.equal(schedules.length, 2);
  assert.equal(schedules[1]?.slots.length, 1);

  await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${validFrom}`,
    admin,
  );
});

test('a change is free from the day after the last booking of its resource', async () => {
  const {today, freeFrom} = await laundry();
  assert.equal(freeFrom, today);

  const id = await book(member, addDays(today, 4), '08:00');
  assert.equal((await laundry()).freeFrom, addDays(today, 5));

  // Another resource is not held back by it.
  const others = (await adminView()).resources.filter(
    (resource) => resource.id !== LAUNDRY,
  );
  assert.ok(others.length > 0);
  assert.ok(others.every((resource) => resource.freeFrom === today));

  // From that day nothing is cancelled, and no window is in the way.
  assert.deepEqual(
    await preview({
      change: 'schedule',
      validFrom: addDays(today, 5),
      slots: [slot('09:00', '13:00')],
    }),
    [],
  );

  await call('DELETE', `/bookings/${id}`, member);
  assert.equal((await laundry()).freeFrom, today);
});

test('new times cancel the bookings whose slot goes, once the admin has seen them', async () => {
  const {today} = await adminView();
  const day = addDays(today, 2);
  const kept = await book(member, day, '08:00');
  const lost = await book(neighbour, day, '12:00');
  const queued = await call('POST', '/subscriptions', member, {
    resourceId: LAUNDRY,
    date: day,
    start: '12:00',
  });
  assert.equal(queued.statusCode, 201, queued.body);
  const token = 'ExponentPushToken[neighbour]';
  await call('POST', '/push-tokens', neighbour, {token, locale: 'sv'});
  const watcher = 'ExponentPushToken[member]';
  await call('POST', '/push-tokens', member, {token: watcher, locale: 'sv'});

  const change = {
    validFrom: addDays(today, 1),
    slots: [slot('08:00', '12:00'), slot('12:30', '16:00')],
  };
  const cancels = await preview({change: 'schedule', ...change});
  assert.deepEqual(cancels, [
    {id: lost, apartment: '2', date: day, start: '12:00', end: '16:00'},
  ]);
  // The preview changes nothing.
  assert.equal((await laundry()).schedules.length, 1);
  assert.deepEqual(await bookingIds(), [kept, lost].sort());

  const unseen = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    change,
  );
  assert.equal(unseen.statusCode, 409);
  assert.equal(codeOf(unseen), 'CHANGE_CANCELS_BOOKINGS');
  assert.equal((await laundry()).schedules.length, 1);
  assert.deepEqual(await bookingIds(), [kept, lost].sort());

  push.clear();
  const mailed = mail.sent.length;
  const agreed = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/schedule`,
    admin,
    {...change, cancels: [lost], reason: {sv: 'Ny maskin på plats'}},
  );
  assert.equal(agreed.statusCode, 204, agreed.body);
  await server.notifier.idle();

  assert.deepEqual(await bookingIds(), [kept]);
  const subscriptions = (await call('GET', '/subscriptions', member)).json<
    unknown[]
  >();
  assert.deepEqual(subscriptions, []);

  // The apartment is told, and the queue is not told of a slot that is
  // gone.
  assert.deepEqual(
    push.sent.map(({to, title, body, channel}) => ({to, title, body, channel})),
    [
      {
        to: token,
        title: 'En bokning har avbokats',
        body: `Föreningen har avbokat Tvättstuga, ${formatWhen('sv', day, '12:00', '16:00')}. Ny maskin på plats`,
        channel: 'slots',
      },
    ],
  );
  const letter = mail.lastTo('2@north.example.com', mailed);
  assert.ok(letter);
  assert.equal(letter.subject, 'Din bokning i Brf Norr har avbokats');
  assert.match(letter.text, /Tvättstuga, .* 12:00–16:00/);
  assert.match(letter.text, /Anledning: Ny maskin på plats/);
  assert.equal(mail.lastTo('1@north.example.com', mailed), undefined);

  const event = await lastEvent();
  assert.equal(event?.action, 'booking.cancel');
  assert.equal(event?.subject, 'Tvättstuga: 2 (Ny maskin på plats)');

  await call('DELETE', `/bookings/${kept}`, member);
  await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${change.validFrom}`,
    admin,
  );
});

test('a closing today cancels what is ahead but not a slot under way', async () => {
  const {today} = await adminView();
  const [underWay] = await db
    .insert(bookings)
    .values({
      organizationId: NORTH.id,
      memberId: apartmentIds.get('1') ?? '',
      resourceId: LAUNDRY,
      date: today,
      start: '00:00',
      end: '23:59',
      endsAt: sql`now() + interval '1 hour'`,
    })
    .returning({id: bookings.id});
  const ahead = await book(neighbour, addDays(today, 1), '08:00');

  const cancels = await preview({change: 'closing', closesFrom: today});
  assert.deepEqual(
    cancels.map((booking) => booking.id),
    [ahead],
  );

  const closed = await call(
    'PUT',
    `/admin/resources/${LAUNDRY}/closing`,
    admin,
    {closesFrom: today, cancels: [ahead]},
  );
  assert.equal(closed.statusCode, 204, closed.body);
  await server.notifier.idle();
  assert.deepEqual(await bookingIds(), [underWay?.id]);

  // Without a reason the mail and push say only what was cancelled.
  const letter = mail.lastTo('2@north.example.com');
  assert.ok(letter && !letter.text.includes('Anledning'));
  assert.equal((await lastEvent())?.subject, 'Tvättstuga: 2');

  await call('DELETE', `/admin/resources/${LAUNDRY}/closing`, admin);
  await db.delete(bookings).where(eq(bookings.resourceId, LAUNDRY));
});

test('removing a coming change cancels what was booked on its slots', async () => {
  const validFrom = await tomorrow();
  await call('PUT', `/admin/resources/${LAUNDRY}/schedule`, admin, {
    validFrom,
    slots: [slot('09:00', '13:00')],
  });
  const lost = await book(neighbour, validFrom, '09:00');

  assert.deepEqual(
    (await preview({change: 'removeSchedule', validFrom})).map(
      (booking) => booking.id,
    ),
    [lost],
  );

  const unseen = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${validFrom}`,
    admin,
  );
  assert.equal(codeOf(unseen), 'CHANGE_CANCELS_BOOKINGS');

  const agreed = await call(
    'DELETE',
    `/admin/resources/${LAUNDRY}/schedule/${validFrom}`,
    admin,
    {cancels: [lost]},
  );
  assert.equal(agreed.statusCode, 204);
  assert.deepEqual(await bookingIds(), []);
  assert.equal((await laundry()).schedules.length, 1);
});

// The window only says how far ahead apartments book.
test('a shorter window changes nothing about what a change cancels', async () => {
  const {today} = await adminView();
  const id = await book(member, addDays(today, 6), '08:00');

  await call('PATCH', '/admin/organization', admin, {bookingWindowDays: 1});

  try {
    assert.equal((await laundry()).freeFrom, addDays(today, 7));
    assert.deepEqual(
      (await preview({change: 'closing', closesFrom: addDays(today, 2)})).map(
        (booking) => booking.id,
      ),
      [id],
    );
  } finally {
    await call('PATCH', '/admin/organization', admin, {
      bookingWindowDays: NORTH.bookingWindowDays,
    });
    await call('DELETE', `/bookings/${id}`, member);
  }
});

test('a closed resource can be removed with all that was booked on it', async () => {
  const {today} = await adminView();
  const kind = await call('POST', '/admin/kinds', admin, {
    name: {sv: 'Gästrum'},
    maxActive: 1,
  });
  const kindId = kind.json<{id: string}>().id;
  const created = await call('POST', '/admin/resources', admin, {
    name: {sv: 'Gästrummet'},
    kindId,
    tags: {},
    slots: [slot('00:00', '23:59')],
  });
  const id = created.json<{id: string}>().id;
  const ahead = await book(member, addDays(today, 1), '00:00', id);

  const open = await call('DELETE', `/admin/resources/${id}`, admin);
  assert.equal(open.statusCode, 409);
  assert.equal(codeOf(open), 'RESOURCE_OPEN');

  // A closing still ahead leaves it open until then.
  await call('PUT', `/admin/resources/${id}/closing`, admin, {
    closesFrom: addDays(today, 2),
  });
  const notYet = await call('DELETE', `/admin/resources/${id}`, admin);
  assert.equal(codeOf(notYet), 'RESOURCE_OPEN');

  // Closed from today, which cancels what lay ahead; one under way and
  // one that has ended stay until the resource goes.
  await db.insert(bookings).values([
    {
      organizationId: NORTH.id,
      memberId: apartmentIds.get('2') ?? '',
      resourceId: id,
      date: addDays(today, -3),
      start: '00:00',
      end: '23:59',
      endsAt: sql`now() - interval '2 days'`,
    },
    {
      organizationId: NORTH.id,
      memberId: apartmentIds.get('2') ?? '',
      resourceId: id,
      date: today,
      start: '00:00',
      end: '23:59',
      endsAt: sql`now() + interval '1 hour'`,
    },
  ]);
  const closed = await call('PUT', `/admin/resources/${id}/closing`, admin, {
    closesFrom: today,
    cancels: [ahead],
  });
  assert.equal(closed.statusCode, 204, closed.body);

  const removed = await call('DELETE', `/admin/resources/${id}`, admin);
  assert.equal(removed.statusCode, 204, removed.body);

  assert.ok(!(await adminView()).resources.some((item) => item.id === id));
  const left = await db
    .select({id: bookings.id})
    .from(bookings)
    .where(eq(bookings.resourceId, id));
  assert.deepEqual(left, []);
  const event = await lastEvent();
  assert.equal(event?.action, 'resource.remove');
  assert.equal(event?.subject, 'Gästrummet');

  // Its kind is no longer in use.
  const kindRemoved = await call('DELETE', `/admin/kinds/${kindId}`, admin);
  assert.equal(kindRemoved.statusCode, 204);
});
