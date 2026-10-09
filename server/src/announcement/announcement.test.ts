import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {buildApp} from '../app.js';
import {pool} from '../db/index.js';
import type {BookingRules} from '../resource/resource.dto.js';
import type {BookingWindow} from '../slot/slot.dto.js';
import {
  assertTestDatabase,
  codeOf,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';
import type {AdminAnnouncement, Announcement} from './announcement.dto.js';

let server: Awaited<ReturnType<typeof buildApp>>;
let admin: {cookie: string};
let member: {cookie: string};
let southMember: {cookie: string};
let today: string;

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  headers: {cookie: string},
  payload?: Record<string, unknown>,
) {
  return server.inject({method, url, headers, payload});
}

async function post(title: string, publishedOn: string, endsOn: string | null) {
  const response = await call('POST', '/admin/announcements', admin, {
    title,
    body: `${title} i detalj`,
    publishedOn,
    endsOn,
  });
  assert.equal(response.statusCode, 201);
  return response.json<{id: string}>().id;
}

before(async () => {
  await assertTestDatabase();

  server = await buildApp({logger: false});
  await resetDatabase();

  for (const id of ['north', 'south']) {
    await seedOrganization({
      organization: {id, name: `Brf ${id}`, bookingWindowDays: 10},
      kinds: [],
      resources: [],
      slots: [],
      apartments: ['1'],
      emailOf: (label) => `${label}@${id}.example.com`,
      adminEmail: `admin@${id}.example.com`,
    });
  }

  admin = {cookie: (await signIn(server, 'admin@north.example.com')).cookie};
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
  await post('Gammal', addDays(today, -10), addDays(today, -1));
  await post('Städdag', addDays(today, -2), null);
  await post('Vattnet stängs', today, today);
  await post('Kommande', addDays(today, 1), null);

  const shown = (await call('GET', '/announcements', member)).json<
    Announcement[]
  >();
  assert.deepEqual(
    shown.map((announcement) => announcement.title),
    ['Vattnet stängs', 'Städdag'],
  );

  const all = (await call('GET', '/admin/announcements', admin)).json<
    AdminAnnouncement[]
  >();
  assert.deepEqual(
    all.map((announcement) => [announcement.title, announcement.status]),
    [
      ['Kommande', 'scheduled'],
      ['Vattnet stängs', 'active'],
      ['Städdag', 'active'],
      ['Gammal', 'ended'],
    ],
  );
});

test('another organization sees none of them', async () => {
  const shown = (await call('GET', '/announcements', southMember)).json<
    Announcement[]
  >();
  assert.deepEqual(shown, []);
});

test('the admin edits and removes an announcement', async () => {
  const id = await post('Fel rubrik', today, null);

  const edited = await call('PUT', `/admin/announcements/${id}`, admin, {
    title: 'Rätt rubrik',
    body: 'Text',
    publishedOn: today,
    endsOn: addDays(today, 7),
  });
  assert.equal(edited.statusCode, 204);
  const shown = (await call('GET', '/announcements', member)).json<
    Announcement[]
  >();
  assert.ok(shown.some((announcement) => announcement.title === 'Rätt rubrik'));

  const removed = await call('DELETE', `/admin/announcements/${id}`, admin);
  assert.equal(removed.statusCode, 204);
  const again = await call('DELETE', `/admin/announcements/${id}`, admin);
  assert.equal(again.statusCode, 404);
});

test('refuses an announcement that ends before it is published', async () => {
  const response = await call('POST', '/admin/announcements', admin, {
    title: 'Baklänges',
    body: 'Text',
    publishedOn: today,
    endsOn: addDays(today, -1),
  });
  assert.equal(response.statusCode, 400);
  assert.equal(codeOf(response), 'VALIDATION');
});

test('only apartments read announcements and only the admin writes them', async () => {
  assert.equal((await call('GET', '/announcements', admin)).statusCode, 403);
  const write = await call('POST', '/admin/announcements', member, {
    title: 'Hej',
    body: 'Text',
    publishedOn: today,
    endsOn: null,
  });
  assert.equal(write.statusCode, 403);
});

test('the house rules reach the apartments with the booking rules', async () => {
  const before = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  assert.equal(before.text, '');

  const saved = await call('PATCH', '/admin/organization', admin, {
    rulesText: 'Städa efter dig.\nTyst efter 22.',
  });
  assert.equal(saved.statusCode, 200);

  const after = (
    await call('GET', '/booking-rules', member)
  ).json<BookingRules>();
  assert.equal(after.text, 'Städa efter dig.\nTyst efter 22.');
});
