import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {eq, sql} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {createUser} from '../auth/auth.service.js';
import {violatedConstraint} from '../db/errors.js';
import {db, pool} from '../db/index.js';
import {members, organizations, pushTokens} from '../db/schema.js';
import type {BookingRules, Resource} from '../resource/resource.dto.js';
import type {BookingWindow, ResourceSchedule} from '../slot/slot.dto.js';
import {
  assertTestDatabase,
  codeOf,
  ORIGIN,
  PASSWORD,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';
import type {Account} from './account.dto.js';

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
  bookingWindowDays: 10,
};

const SLOTS = [{start: '08:00', end: '12:00'}];

let server: Awaited<ReturnType<typeof buildApp>>;
const ids = new Map<string, string>();

function northEmail(apartment: string) {
  return `${apartment}@north.example.com`;
}

function southEmail(apartment: string) {
  return `${apartment}@south.example.com`;
}

async function cookieOf(email: string) {
  return {cookie: (await signIn(server, email)).cookie};
}

function get(url: string, headers: {cookie: string}) {
  return server.inject({method: 'GET', url, headers});
}

before(async () => {
  await assertTestDatabase();

  server = await buildApp({logger: false});
  await resetDatabase();

  const north = await seedOrganization({
    organization: NORTH,
    kinds: [{id: 'laundry', name: 'Tvätt', maxActive: 1}],
    resources: [
      {
        id: 'north-laundry',
        kindId: 'laundry',
        name: 'Tvättstuga Norr',
        tags: [],
        sortOrder: 1,
      },
    ],
    slots: SLOTS.map((slot) => ({...slot, resourceId: 'north-laundry'})),
    apartments: ['1', '2'],
    emailOf: northEmail,
    adminEmail: 'admin@north.example.com',
  });
  const south = await seedOrganization({
    organization: SOUTH,
    kinds: [{id: 'sauna', name: 'Bastu', maxActive: 1}],
    resources: [
      {
        id: 'south-sauna',
        kindId: 'sauna',
        name: 'Bastu Söder',
        tags: [],
        sortOrder: 1,
      },
    ],
    slots: SLOTS.map((slot) => ({...slot, resourceId: 'south-sauna'})),
    apartments: ['1'],
    emailOf: southEmail,
    adminEmail: 'admin@south.example.com',
  });

  for (const [label, id] of north) {
    ids.set(`north-${label}`, id);
  }
  for (const [label, id] of south) {
    ids.set(`south-${label}`, id);
  }
});

after(async () => {
  await server.close();
  await pool.end();
});

test('tells an apartment who it is', async () => {
  const response = await get('/account', await cookieOf(northEmail('1')));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json<Account>(), {
    role: 'member',
    organizationName: NORTH.name,
    apartment: '1',
  });
});

test('tells the admin who it is', async () => {
  const response = await get(
    '/account',
    await cookieOf('admin@south.example.com'),
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json<Account>(), {
    role: 'admin',
    organizationName: SOUTH.name,
  });
});

test('rejects /account without a session', async () => {
  const response = await server.inject({method: 'GET', url: '/account'});

  assert.equal(response.statusCode, 401);
  assert.equal(codeOf(response), 'UNAUTHORIZED');
});

// Every route an apartment uses checks the role in its handler, so each one
// is listed here; a new member route belongs in this list too.
test('an admin cannot use what only apartments use', async () => {
  const admin = await cookieOf('admin@north.example.com');
  const id = '00000000-0000-4000-8000-000000000000';
  const slot = {
    resourceId: 'north-laundry',
    date: '2030-01-01',
    start: '08:00',
  };
  const token = {token: 'ExponentPushToken[admin]'};
  const requests: [string, string, Record<string, unknown>?][] = [
    ['GET', '/resources'],
    ['GET', '/booking-window'],
    ['GET', '/booking-rules'],
    ['GET', '/slots?date=2030-01-01&resourceId=north-laundry'],
    ['GET', '/schedule?from=2030-01-01&to=2030-01-02'],
    ['GET', '/bookings'],
    ['POST', '/bookings', slot],
    ['DELETE', `/bookings/${id}`],
    ['GET', '/subscriptions'],
    ['POST', '/subscriptions', slot],
    ['DELETE', `/subscriptions/${id}`],
    ['POST', '/push-tokens', token],
  ];

  for (const [method, url, payload] of requests) {
    const response = await server.inject({
      method: method as 'GET' | 'POST' | 'DELETE',
      url,
      headers: admin,
      payload,
    });
    assert.equal(response.statusCode, 403, `${method} ${url}`);
    assert.equal(codeOf(response), 'FORBIDDEN', `${method} ${url}`);
  }
});

// Only the fields marked input: false keep an apartment from making
// itself admin, or moving into another organization, through Better Auth.
test('nobody can change their own role, organization or apartment', async () => {
  const headers = await cookieOf(northEmail('1'));

  for (const field of [
    {role: 'admin'},
    {organizationId: SOUTH.id},
    {memberId: ids.get('south-1') ?? ''},
  ]) {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/update-user',
      headers: {...headers, origin: ORIGIN},
      payload: field,
    });
    assert.equal(response.statusCode, 400, JSON.stringify(field));
  }

  const account = await get('/account', headers);
  assert.deepEqual(account.json<Account>(), {
    role: 'member',
    organizationName: NORTH.name,
    apartment: '1',
  });
});

test('an apartment sees only its own organization', async () => {
  const south = await cookieOf(southEmail('1'));

  const resources = await get('/resources', south);
  assert.deepEqual(
    resources.json<Resource[]>().map((resource) => resource.id),
    ['south-sauna'],
  );

  const rules = await get('/booking-rules', south);
  assert.deepEqual(
    rules.json<BookingRules>().kinds.map((kind) => kind.id),
    ['sauna'],
  );

  const window = (await get('/booking-window', south)).json<BookingWindow>();
  const schedule = await get(
    `/schedule?from=${window.from}&to=${window.to}`,
    south,
  );
  assert.deepEqual(
    schedule.json<ResourceSchedule[]>().map((entry) => entry.resourceId),
    ['south-sauna'],
  );
});

test("an apartment cannot reach another organization's resource", async () => {
  const south = await cookieOf(southEmail('1'));
  const window = (await get('/booking-window', south)).json<BookingWindow>();

  const slots = await get(
    `/slots?date=${window.from}&resourceId=north-laundry`,
    south,
  );
  assert.equal(slots.statusCode, 404);
  assert.equal(codeOf(slots), 'NOT_FOUND');

  const booking = await server.inject({
    method: 'POST',
    url: '/bookings',
    headers: south,
    payload: {resourceId: 'north-laundry', date: window.to, start: '08:00'},
  });
  assert.equal(booking.statusCode, 404);
  assert.equal(codeOf(booking), 'NOT_FOUND');
});

test('rejects an apartment that has moved out', async () => {
  const headers = await cookieOf(northEmail('2'));
  await db
    .update(members)
    .set({leftAt: new Date()})
    .where(eq(members.id, ids.get('north-2') ?? ''));

  const response = await get('/account', headers);

  assert.equal(response.statusCode, 401);
  assert.equal(codeOf(response), 'UNAUTHORIZED');
});

function refusedBy(constraint: string) {
  return (error: unknown) => {
    assert.equal(violatedConstraint(error), constraint);
    return true;
  };
}

test('allows only one admin per organization', async () => {
  await assert.rejects(
    createUser({
      email: 'second-admin@north.example.com',
      password: PASSWORD,
      name: 'Admin två',
      organizationId: NORTH.id,
      role: 'admin',
    }),
    refusedBy('user_one_admin_per_organization'),
  );
});

test('refuses an apartment account without an apartment', async () => {
  await assert.rejects(
    db.execute(
      sql`insert into "user" (id, name, email, role, organization_id) values ('x', 'Ingen', 'nobody@north.example.com', 'member', 'north')`,
    ),
    refusedBy('user_role_member_check'),
  );
});

test('refuses an admin tied to an apartment', async () => {
  await db.insert(organizations).values({
    id: 'east',
    name: 'Brf Öster',
    timeZone: 'Europe/Stockholm',
    bookingWindowDays: 30,
  });
  const [apartment] = await db
    .insert(members)
    .values({organizationId: 'east', label: '1'})
    .returning({id: members.id});

  await assert.rejects(
    db.execute(
      sql`insert into "user" (id, name, email, role, organization_id, member_id) values ('y', 'Admin', 'admin@east.example.com', 'admin', 'east', ${apartment?.id})`,
    ),
    refusedBy('user_role_member_check'),
  );
});

test("refuses an account tied to another organization's apartment", async () => {
  const [empty] = await db
    .insert(members)
    .values({organizationId: NORTH.id, label: 'utan konto'})
    .returning({id: members.id});

  await assert.rejects(
    createUser({
      email: 'crossed@south.example.com',
      password: PASSWORD,
      name: 'Fel förening',
      organizationId: SOUTH.id,
      role: 'member',
      memberId: empty?.id ?? '',
    }),
    refusedBy('user_member_fk'),
  );
});

test('the admin unbinds an apartment token left on its device', async () => {
  const token = 'ExponentPushToken[shared-phone]';
  await db
    .insert(pushTokens)
    .values({token, memberId: ids.get('north-1') ?? ''});

  const response = await server.inject({
    method: 'DELETE',
    url: '/push-tokens',
    headers: await cookieOf('admin@north.example.com'),
    payload: {token},
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(
    await db.select().from(pushTokens).where(eq(pushTokens.token, token)),
    [],
  );
});
