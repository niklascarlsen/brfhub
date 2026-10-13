import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {eq} from 'drizzle-orm';

import {buildApp} from '../app.js';
import {db, pool} from '../db/index.js';
import {announcements} from '../db/schema.js';
import {addDays} from '../lib/time.js';
import type {BookingRules} from '../resource/resource.dto.js';
import type {BookingWindow} from '../slot/slot.dto.js';
import {
  assertTestDatabase,
  codeOf,
  memoryMail,
  memoryPush,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';
import type {AdminAnnouncements, Announcement} from './announcement.dto.js';

let server: Awaited<ReturnType<typeof buildApp>>;
let admin: {cookie: string};
let southAdmin: {cookie: string};
let member: {cookie: string};
let southMember: {cookie: string};
let today: string;

function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  headers: {cookie: string},
  payload?: Record<string, unknown>,
) {
  return server.inject({method, url, headers, payload});
}

async function post(title: string, endsOn: string | null) {
  const response = await call('POST', '/admin/announcements', admin, {
    title: {sv: title},
    body: {sv: `${title} i detalj`},
    endsOn,
  });
  assert.equal(response.statusCode, 201);
  return response.json<{id: string}>().id;
}

// The admin publishes from today; earlier and later days are set up here.
async function insert(
  title: string,
  publishedOn: string,
  endsOn: string | null,
) {
  const [row] = await db
    .insert(announcements)
    .values({
      organizationId: 'north',
      title: {sv: title},
      body: {sv: `${title} i detalj`},
      publishedOn,
      endsOn,
    })
    .returning({id: announcements.id});
  return row?.id ?? '';
}

async function shownTo(headers: {cookie: string}) {
  return (await call('GET', '/announcements', headers)).json<Announcement[]>();
}

async function adminView(headers = admin) {
  return (
    await call('GET', '/admin/announcements', headers)
  ).json<AdminAnnouncements>();
}

before(async () => {
  await assertTestDatabase();

  server = await buildApp({
    logger: false,
    push: memoryPush().send,
    mail: memoryMail().send,
  });
  await resetDatabase();

  for (const id of ['north', 'south']) {
    await seedOrganization({
      organization: {
        id,
        name: `Brf ${id}`,
        timeZone: 'Europe/Stockholm',
        bookingWindowDays: 10,
      },
      kinds: [],
      resources: [],
      slots: [],
      apartments: ['1'],
      emailOf: (label) => `${label}@${id}.example.com`,
      adminEmail: `admin@${id}.example.com`,
    });
  }

  admin = {cookie: (await signIn(server, 'admin@north.example.com')).cookie};
  southAdmin = {
    cookie: (await signIn(server, 'admin@south.example.com')).cookie,
  };
  member = {cookie: (await signIn(server, '1@north.example.com')).cookie};
  southMember = {
    cookie: (await signIn(server, '1@south.example.com')).cookie,
  };
  today = (await call('GET', '/booking-window', member)).json<BookingWindow>()
    .today;
});

after(async () => {
  await server.close();
  await pool.end();
});

test('an apartment sees what is published and not yet ended, newest first', async () => {
  await insert('Gammal', addDays(today, -10), addDays(today, -1));
  await insert('Städdag', addDays(today, -2), null);
  await post('Vattnet stängs', today);
  await insert('Kommande', addDays(today, 1), null);

  assert.deepEqual(
    (await shownTo(member)).map((announcement) => announcement.title),
    ['Vattnet stängs', 'Städdag'],
  );

  const view = await adminView();
  assert.equal(view.today, today);
  assert.deepEqual(
    view.announcements.map((announcement) => [
      announcement.title.sv,
      announcement.status,
    ]),
    [
      ['Kommande', 'scheduled'],
      ['Vattnet stängs', 'active'],
      ['Städdag', 'active'],
      ['Gammal', 'ended'],
    ],
  );
});

test('another organization sees none of them', async () => {
  assert.deepEqual(await shownTo(southMember), []);
  assert.deepEqual((await adminView(southAdmin)).announcements, []);
});

test('an announcement is published the day it is written', async () => {
  const response = await call('POST', '/admin/announcements', admin, {
    title: {sv: 'Ny'},
    body: {sv: 'Text'},
    publishedOn: addDays(today, 5),
    endsOn: null,
  });
  assert.equal(response.statusCode, 201);
  const id = response.json<{id: string}>().id;

  const created = (await adminView()).announcements.find(
    (announcement) => announcement.id === id,
  );
  assert.equal(created?.publishedOn, today);
  await call('DELETE', `/admin/announcements/${id}`, admin);
});

test('the admin edits and removes an announcement', async () => {
  const id = await post('Fel rubrik', null);
  const before = (await shownTo(member)).find((item) => item.id === id);

  const edited = await call('PUT', `/admin/announcements/${id}`, admin, {
    title: {sv: 'Rätt rubrik'},
    body: {sv: 'Rätt text'},
    endsOn: addDays(today, 6),
  });
  assert.equal(edited.statusCode, 204);
  const after = (await shownTo(member)).find((item) => item.id === id);
  assert.deepEqual(
    [after?.title, after?.body, after?.publishedOn, after?.endsOn],
    ['Rätt rubrik', 'Rätt text', today, addDays(today, 6)],
  );
  // What lets a device that hid it show it again.
  assert.notEqual(after?.updatedAt, before?.updatedAt);

  const removed = await call('DELETE', `/admin/announcements/${id}`, admin);
  assert.equal(removed.statusCode, 204);
  const again = await call('DELETE', `/admin/announcements/${id}`, admin);
  assert.equal(again.statusCode, 404);
});

test('refuses an end before today', async () => {
  const created = await call('POST', '/admin/announcements', admin, {
    title: {sv: 'Baklänges'},
    body: {sv: 'Text'},
    endsOn: addDays(today, -1),
  });
  assert.equal(created.statusCode, 400);
  assert.equal(codeOf(created), 'ENDS_IN_PAST');

  const id = await insert('Sedan länge', addDays(today, -10), null);
  const edited = await call('PUT', `/admin/announcements/${id}`, admin, {
    title: {sv: 'Sedan länge'},
    body: {sv: 'Text'},
    endsOn: addDays(today, -4),
  });
  assert.equal(edited.statusCode, 400);
  assert.equal(codeOf(edited), 'ENDS_IN_PAST');

  await db.delete(announcements).where(eq(announcements.id, id));
});

test('an ended announcement can still have its text corrected', async () => {
  const id = await insert('Stavfel', addDays(today, -10), addDays(today, -3));

  const edited = await call('PUT', `/admin/announcements/${id}`, admin, {
    title: {sv: 'Rättat'},
    body: {sv: 'Text'},
    endsOn: addDays(today, -3),
  });
  assert.equal(edited.statusCode, 204);

  await db.delete(announcements).where(eq(announcements.id, id));
});

test('refuses empty, blank and too long texts', async () => {
  const cases = [
    {title: {sv: '   '}, body: {sv: 'Text'}},
    {title: {sv: 'Rubrik'}, body: {sv: ' \n '}},
    {title: {sv: 'x'.repeat(101)}, body: {sv: 'Text'}},
    {title: {sv: 'Rubrik'}, body: {sv: 'x'.repeat(2001)}},
  ];

  for (const fields of cases) {
    const response = await call('POST', '/admin/announcements', admin, {
      ...fields,
      endsOn: null,
    });
    assert.equal(response.statusCode, 400, JSON.stringify(fields).slice(0, 60));
    assert.equal(codeOf(response), 'VALIDATION');
  }

  const id = await post('Rubrik', null);
  const blank = await call('PUT', `/admin/announcements/${id}`, admin, {
    title: {sv: ' '},
    body: {sv: 'Text'},
    endsOn: null,
  });
  assert.equal(codeOf(blank), 'VALIDATION');
  await call('DELETE', `/admin/announcements/${id}`, admin);

  const badId = await call('DELETE', '/admin/announcements/nope', admin);
  assert.equal(codeOf(badId), 'VALIDATION');
});

test("an admin cannot touch another organization's announcements", async () => {
  const id = await post('Norr', null);

  const edited = await call('PUT', `/admin/announcements/${id}`, southAdmin, {
    title: {sv: 'Söder'},
    body: {sv: 'Text'},
    endsOn: null,
  });
  assert.equal(edited.statusCode, 404);
  const removed = await call(
    'DELETE',
    `/admin/announcements/${id}`,
    southAdmin,
  );
  assert.equal(removed.statusCode, 404);

  assert.ok((await shownTo(member)).some((item) => item.title === 'Norr'));
  await call('DELETE', `/admin/announcements/${id}`, admin);
});

test('only apartments read announcements and only the admin writes them', async () => {
  assert.equal((await call('GET', '/announcements', admin)).statusCode, 403);

  const id = '00000000-0000-4000-8000-000000000000';
  const body = {title: {sv: 'Hej'}, body: {sv: 'Text'}, endsOn: null};
  const requests: ['GET' | 'POST' | 'PUT' | 'DELETE', string][] = [
    ['GET', '/admin/announcements'],
    ['POST', '/admin/announcements'],
    ['PUT', `/admin/announcements/${id}`],
    ['DELETE', `/admin/announcements/${id}`],
  ];

  for (const [method, url] of requests) {
    const response = await call(
      method,
      url,
      member,
      method === 'POST' || method === 'PUT' ? body : undefined,
    );
    assert.equal(response.statusCode, 403, `${method} ${url}`);
  }
});

test('the house rules reach only their own apartments', async () => {
  const before = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  assert.equal(before.text, '');

  const saved = await call('PATCH', '/admin/organization', admin, {
    rulesText: {sv: '  Städa efter dig.\nTyst efter 22.  '},
  });
  assert.equal(saved.statusCode, 200);

  const after = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  assert.equal(after.text, 'Städa efter dig.\nTyst efter 22.');

  const south = (
    await call('GET', '/booking-rules', southMember)
  ).json<BookingRules>();
  assert.equal(south.text, '');

  const tooLong = await call('PATCH', '/admin/organization', admin, {
    rulesText: {sv: 'x'.repeat(4001)},
  });
  assert.equal(codeOf(tooLong), 'VALIDATION');

  const cleared = await call('PATCH', '/admin/organization', admin, {
    rulesText: {sv: '   '},
  });
  assert.equal(cleared.statusCode, 200);
  assert.equal(
    (await call('GET', '/booking-rules', member)).json<BookingRules>().text,
    '',
  );
});
