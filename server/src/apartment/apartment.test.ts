import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {eq} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool, type Executor} from '../db/index.js';
import {
  bookings,
  members,
  pushTokens,
  subscriptions,
  user,
} from '../db/schema.js';
import {lockApartmentBookings} from '../booking/lifecycle.js';
import {createBooking} from '../booking/booking.service.js';
import {addDays, isoDateIn, slotEndsAt} from '../lib/time.js';
import {
  assertTestDatabase,
  codeOf,
  memoryMail,
  memoryPush,
  PASSWORD,
  resetDatabase,
  seedOrganization,
  signIn,
  waitUntilBlocked,
} from '../test/fixtures.js';
import type {Apartment} from './apartment.dto.js';

const NORTH = {
  id: 'north',
  name: 'Brf Norr',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
};
const SOUTH = {
  id: 'south',
  name: 'Brf Söder',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
};
const SLOT = {start: '08:00', end: '12:00'};

let server: Awaited<ReturnType<typeof buildApp>>;
const push = memoryPush();
const mail = memoryMail();
let admin: {cookie: string};
let southAdmin: {cookie: string};
const ids = new Map<string, string>();

function northEmail(apartment: string) {
  return `${apartment}@north.example.com`;
}

function inDays(days: number) {
  return addDays(isoDateIn(NORTH.timeZone), days);
}

async function cookieOf(email: string, password?: string) {
  const {response, cookie} = await signIn(server, email, password);
  return {status: response.statusCode, cookie};
}

function call(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  headers: {cookie: string},
  payload?: Record<string, unknown>,
) {
  return server.inject({method, url, headers, payload});
}

async function apartmentsOf(headers: {cookie: string}) {
  return (await call('GET', '/admin/apartments', headers)).json<Apartment[]>();
}

async function insertBooking(
  label: string,
  days: number,
  executor: Executor = db,
) {
  const date = inDays(days);
  await executor.insert(bookings).values({
    organizationId: NORTH.id,
    memberId: ids.get(label) ?? '',
    resourceId: 'north-laundry',
    date,
    start: SLOT.start,
    end: SLOT.end,
    endsAt: slotEndsAt(NORTH.timeZone, date, SLOT.end),
  });
}

before(async () => {
  await assertTestDatabase();

  server = await buildApp({logger: false, push: push.send, mail: mail.send});
  await resetDatabase();

  const north = await seedOrganization({
    organization: NORTH,
    kinds: [{id: 'laundry', name: {sv: 'Tvätt'}, maxActive: 1}],
    resources: [
      {
        id: 'north-laundry',
        kindId: 'laundry',
        name: {sv: 'Tvättstuga'},
        tags: {},
        sortOrder: 1,
      },
    ],
    slots: [{...SLOT, resourceId: 'north-laundry'}],
    apartments: ['9', '12', '14', '21', '31', '32', '33', '34'],
    emailOf: northEmail,
    adminEmail: 'admin@north.example.com',
  });
  await seedOrganization({
    organization: SOUTH,
    kinds: [],
    resources: [],
    slots: [],
    apartments: ['1'],
    emailOf: (label) => `${label}@south.example.com`,
    adminEmail: 'admin@south.example.com',
  });

  for (const [label, id] of north) {
    ids.set(label, id);
  }

  admin = await cookieOf('admin@north.example.com');
  southAdmin = await cookieOf('admin@south.example.com');
});

after(async () => {
  await server.close();
  await pool.end();
});

test('lists the apartments of the admin organization in number order', async () => {
  const apartments = await apartmentsOf(admin);

  assert.deepEqual(
    apartments.map((apartment) => apartment.label),
    ['9', '12', '14', '21', '31', '32', '33', '34'],
  );
  assert.equal(apartments[0]?.email, northEmail('9'));
  assert.equal(apartments[0]?.residentName, 'Lägenhet 9');
});

test('only the admin manages apartments', async () => {
  const member = await cookieOf(northEmail('12'));
  const response = await call('GET', '/admin/apartments', member);

  assert.equal(response.statusCode, 403);
  assert.equal(codeOf(response), 'FORBIDDEN');
});

test("an admin cannot touch another organization's apartment", async () => {
  const id = ids.get('14') ?? '';
  const requests = [
    call('PATCH', `/admin/apartments/${id}`, southAdmin, {label: '99'}),
    call('POST', `/admin/apartments/${id}/sign-out`, southAdmin),
    call('POST', `/admin/apartments/${id}/new-resident`, southAdmin, {
      residentName: 'Inkräktare',
      email: 'intruder@south.example.com',
    }),
    call('DELETE', `/admin/apartments/${id}`, southAdmin),
  ];

  for (const [index, response] of (await Promise.all(requests)).entries()) {
    assert.equal(response.statusCode, 404, `request ${index}`);
    assert.equal(codeOf(response), 'NOT_FOUND');
  }

  assert.equal((await cookieOf(northEmail('14'))).status, 200);
});

test('adds an apartment, welcomes the resident and signs it in by code', async () => {
  const response = await call('POST', '/admin/apartments', admin, {
    label: '41',
    residentName: 'Anna och Erik Svensson',
    email: 'Anna@Example.com',
  });

  assert.equal(response.statusCode, 201);
  const apartment = response.json<Apartment>();
  assert.equal(apartment.label, '41');
  assert.equal(apartment.email, 'anna@example.com');

  await server.notifier.idle();
  const welcome = mail.lastTo('anna@example.com');
  assert.match(welcome?.subject ?? '', /Brf Norr/);
  assert.match(welcome?.text ?? '', /koden/);

  const signedIn = await cookieOf('anna@example.com');
  assert.equal(signedIn.status, 200);
  const account = await call('GET', '/account', signedIn);
  assert.equal(
    account.json<{member: {apartment: string}}>().member.apartment,
    '41',
  );
});

test('an apartment has no password to sign in with', async () => {
  assert.equal((await cookieOf(northEmail('12'), PASSWORD)).status, 401);
});

test('refuses a taken number or email and adds nothing', async () => {
  const before = (await apartmentsOf(admin)).length;

  const number = await call('POST', '/admin/apartments', admin, {
    label: '12',
    residentName: 'Dubblett',
    email: 'new-12@example.com',
  });
  assert.equal(number.statusCode, 409);
  assert.equal(codeOf(number), 'APARTMENT_TAKEN');

  const email = await call('POST', '/admin/apartments', admin, {
    label: '42',
    residentName: 'Dubblett',
    email: northEmail('12'),
  });
  assert.equal(email.statusCode, 409);
  assert.equal(codeOf(email), 'EMAIL_TAKEN');

  assert.equal((await apartmentsOf(admin)).length, before);
});

test('a new email signs out whoever used the old one', async () => {
  const id = ids.get('21') ?? '';
  const old = await cookieOf(northEmail('21'));

  const response = await call('PATCH', `/admin/apartments/${id}`, admin, {
    residentName: 'Karin Lund',
    email: 'karin@example.com',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json<Apartment>().residentName, 'Karin Lund');

  assert.equal((await call('GET', '/account', old)).statusCode, 401);
  assert.equal((await cookieOf('karin@example.com')).status, 200);
});

test('signing the apartment out ends every session, and a new code gets back in', async () => {
  const id = ids.get('9') ?? '';
  const old = await cookieOf(northEmail('9'));

  const response = await call(
    'POST',
    `/admin/apartments/${id}/sign-out`,
    admin,
  );
  assert.equal(response.statusCode, 204);

  assert.equal((await call('GET', '/account', old)).statusCode, 401);
  assert.equal((await cookieOf(northEmail('9'))).status, 200);
});

test('a new resident replaces the account and cancels its bookings', async () => {
  const id = ids.get('14') ?? '';
  const old = await cookieOf(northEmail('14'));
  await insertBooking('14', 2);
  await db.insert(subscriptions).values({
    organizationId: NORTH.id,
    memberId: id,
    resourceId: 'north-laundry',
    date: inDays(3),
    start: SLOT.start,
    end: SLOT.end,
    endsAt: slotEndsAt(NORTH.timeZone, inDays(3), SLOT.end),
  });

  const listed = (await apartmentsOf(admin)).find((item) => item.id === id);
  assert.equal(listed?.upcomingBookings, 1);

  const response = await call(
    'POST',
    `/admin/apartments/${id}/new-resident`,
    admin,
    {residentName: 'Ny Boende', email: 'ny@example.com'},
  );
  assert.equal(response.statusCode, 200);
  const apartment = response.json<Apartment>();
  assert.equal(apartment.id, id);
  assert.equal(apartment.upcomingBookings, 0);

  assert.equal((await call('GET', '/account', old)).statusCode, 401);
  assert.equal((await cookieOf(northEmail('14'))).status, 400);
  assert.equal((await cookieOf('ny@example.com')).status, 200);
  assert.deepEqual(
    await db.select().from(subscriptions).where(eq(subscriptions.memberId, id)),
    [],
  );
});

test('a taken email for a new resident changes nothing', async () => {
  const id = ids.get('12') ?? '';
  await insertBooking('12', 4);

  const response = await call(
    'POST',
    `/admin/apartments/${id}/new-resident`,
    admin,
    {residentName: 'Krock', email: 'karin@example.com'},
  );
  assert.equal(response.statusCode, 409);
  assert.equal(codeOf(response), 'EMAIL_TAKEN');

  const listed = (await apartmentsOf(admin)).find((item) => item.id === id);
  assert.equal(listed?.upcomingBookings, 1);
  assert.equal((await cookieOf(northEmail('12'))).status, 200);
});

test('removing an apartment frees its number', async () => {
  const id = ids.get('12') ?? '';
  const old = await cookieOf(northEmail('12'));

  const response = await call('DELETE', `/admin/apartments/${id}`, admin);
  assert.equal(response.statusCode, 204);

  assert.equal((await call('GET', '/account', old)).statusCode, 401);
  assert.deepEqual(
    await db
      .select({id: bookings.id})
      .from(bookings)
      .where(eq(bookings.memberId, id)),
    [],
  );
  const [row] = await db
    .select({leftAt: members.leftAt})
    .from(members)
    .where(eq(members.id, id));
  assert.notEqual(row?.leftAt, null);

  const again = await call('POST', '/admin/apartments', admin, {
    label: '12',
    residentName: 'Nya tolvan',
    email: 'nya-12@example.com',
  });
  assert.equal(again.statusCode, 201);
});

let tokenCount = 0;

async function insertToken(label: string) {
  tokenCount += 1;
  const token = `ExponentPushToken[${label}-${tokenCount}]`;
  await db
    .insert(pushTokens)
    .values({token, memberId: ids.get(label) ?? '', locale: 'sv'});
  return token;
}

async function tokensOf(label: string) {
  return db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .where(eq(pushTokens.memberId, ids.get(label) ?? ''));
}

test('rejects the admin routes without a session', async () => {
  const response = await server.inject({
    method: 'GET',
    url: '/admin/apartments',
  });
  assert.equal(response.statusCode, 401);
});

test('a new name alone keeps the apartment signed in', async () => {
  const id = ids.get('31') ?? '';
  const signedIn = await cookieOf(northEmail('31'));
  await insertToken('31');

  const response = await call('PATCH', `/admin/apartments/${id}`, admin, {
    residentName: 'Nytt Namn',
  });
  assert.equal(response.statusCode, 200);
  assert.equal((await call('GET', '/account', signedIn)).statusCode, 200);
  assert.equal((await tokensOf('31')).length, 1);
});

test('refuses to change to a taken number or email', async () => {
  const id = ids.get('31') ?? '';
  const cases = [
    [{label: '9'}, 'APARTMENT_TAKEN'],
    [{email: northEmail('9')}, 'EMAIL_TAKEN'],
    [{email: 'admin@north.example.com'}, 'EMAIL_TAKEN'],
  ] as const;

  for (const [body, code] of cases) {
    const response = await call(
      'PATCH',
      `/admin/apartments/${id}`,
      admin,
      body,
    );
    assert.equal(response.statusCode, 409, JSON.stringify(body));
    assert.equal(codeOf(response), code);
  }
});

test('a new email or a sign-out also stops the old device getting push', async () => {
  await insertToken('32');
  const byEmail = await call(
    'PATCH',
    `/admin/apartments/${ids.get('32') ?? ''}`,
    admin,
    {email: 'ny-32@example.com'},
  );
  assert.equal(byEmail.statusCode, 200);
  assert.deepEqual(await tokensOf('32'), []);

  await insertToken('31');
  const bySignOut = await call(
    'POST',
    `/admin/apartments/${ids.get('31') ?? ''}/sign-out`,
    admin,
  );
  assert.equal(bySignOut.statusCode, 204);
  assert.deepEqual(await tokensOf('31'), []);
});

test('remembers the last sign-in after a sign-out', async () => {
  const id = ids.get('33') ?? '';
  const never = (await apartmentsOf(admin)).find((item) => item.id === id);
  assert.equal(never?.lastSignInOn, null);

  await cookieOf(northEmail('33'));

  const signedIn = (await apartmentsOf(admin)).find((item) => item.id === id);
  assert.equal(signedIn?.lastSignInOn, isoDateIn(NORTH.timeZone));

  await call('POST', `/admin/apartments/${id}/sign-out`, admin);
  const after = (await apartmentsOf(admin)).find((item) => item.id === id);
  assert.equal(after?.lastSignInOn, signedIn.lastSignInOn);
});

test('two new residents at once leave one account on the apartment', async () => {
  const id = ids.get('33') ?? '';
  await insertToken('33');

  const responses = await Promise.all(
    ['first', 'second'].map((name) =>
      call('POST', `/admin/apartments/${id}/new-resident`, admin, {
        residentName: name,
        email: `${name}-33@example.com`,
      }),
    ),
  );
  for (const response of responses) {
    assert.equal(response.statusCode, 200);
  }

  const accounts = await db
    .select({email: user.email})
    .from(user)
    .where(eq(user.memberId, id));
  assert.equal(accounts.length, 1);
  assert.deepEqual(await tokensOf('33'), []);
  assert.equal(
    (await apartmentsOf(admin)).filter((item) => item.id === id).length,
    1,
  );
});

test('an account replaced while it waited cannot book', async () => {
  const id = ids.get('34') ?? '';
  const [old] = await db
    .select({userId: user.id})
    .from(user)
    .where(eq(user.memberId, id));

  await call('POST', `/admin/apartments/${id}/new-resident`, admin, {
    residentName: 'Efter',
    email: 'efter-34@example.com',
  });

  await assert.rejects(
    createBooking({
      member: {
        id,
        organizationId: NORTH.id,
        timeZone: NORTH.timeZone,
        locales: ['sv'],
        locale: 'sv',
        label: '34',
        userId: old?.userId ?? '',
      },
      date: inDays(2),
      start: SLOT.start,
      resourceId: 'north-laundry',
      notifier: server.notifier,
    }),
    (error: unknown) => codeOf({json: () => error as never}) === 'UNAUTHORIZED',
  );
  assert.deepEqual(
    await db
      .select({id: bookings.id})
      .from(bookings)
      .where(eq(bookings.memberId, id)),
    [],
  );
});

test('trims and lower-cases a typed email', async () => {
  const response = await call('POST', '/admin/apartments', admin, {
    label: '51',
    residentName: 'Mellanslag',
    email: '  Spaced@Example.com ',
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json<Apartment>().email, 'spaced@example.com');
});

test('the slots of a removed apartment are announced to their queue', async () => {
  const added = await call('POST', '/admin/apartments', admin, {
    label: '61',
    residentName: 'Flyttar',
    email: 'flyttar-61@example.com',
  });
  const id = added.json<Apartment>().id;
  ids.set('61', id);
  await insertBooking('61', 2);
  const date = inDays(2);
  await db.insert(subscriptions).values({
    organizationId: NORTH.id,
    memberId: ids.get('21') ?? '',
    resourceId: 'north-laundry',
    date,
    start: SLOT.start,
    end: SLOT.end,
    endsAt: slotEndsAt(NORTH.timeZone, date, SLOT.end),
  });
  const token = await insertToken('21');
  await server.notifier.idle();
  push.clear();

  const response = await call('DELETE', `/admin/apartments/${id}`, admin);
  await server.notifier.idle();

  assert.equal(response.statusCode, 204);
  assert.deepEqual(
    push.sent.map(({to, data}) => ({to, date: data?.date})),
    [{to: token, date}],
  );
});

test('a booking under way and a new resident wait their turn instead of deadlocking', async () => {
  const added = await call('POST', '/admin/apartments', admin, {
    label: '62',
    residentName: 'Bokar',
    email: 'bokar-62@example.com',
  });
  const id = added.json<Apartment>().id;
  ids.set('62', id);
  let replaced: ReturnType<typeof call> | undefined;

  // Holds the apartment's lock and then writes a booking, as booking does,
  // with the new resident arriving in between.
  await db.transaction(async (tx) => {
    await lockApartmentBookings(tx, id);
    replaced = call('POST', `/admin/apartments/${id}/new-resident`, admin, {
      residentName: 'Efter',
      email: 'efter-62@example.com',
    });
    await waitUntilBlocked('advisory');
    await insertBooking('62', 5, tx);
  });

  assert.equal((await replaced)?.statusCode, 200);
  assert.deepEqual(
    await db
      .select({id: bookings.id})
      .from(bookings)
      .where(eq(bookings.memberId, id)),
    [],
  );
});
