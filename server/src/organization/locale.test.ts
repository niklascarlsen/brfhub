import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {eq} from 'drizzle-orm';

import {buildApp} from '../app.js';
import type {Account} from '../account/account.dto.js';
import type {
  AdminAnnouncements,
  Announcement,
} from '../announcement/announcement.dto.js';
import {releasedNotification} from '../booking/booking.notification.js';
import {db, pool} from '../db/index.js';
import {announcements, user} from '../db/schema.js';
import {resolveLocale} from '../lib/locale.js';
import {sendBookingsCancelled} from '../mail/mail.service.js';
import type {BookingRules, Resource} from '../resource/resource.dto.js';
import type {AdminResources} from '../resourceAdmin/resourceAdmin.dto.js';
import {
  assertTestDatabase,
  codeOf,
  memoryMail,
  memoryPush,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';
import type {OrganizationSettings} from './organization.dto.js';

let server: Awaited<ReturnType<typeof buildApp>>;
let member: {cookie: string};
let admin: {cookie: string};
let swedishMember: {cookie: string};
let mail: ReturnType<typeof memoryMail>;

const BOTH = {
  id: 'both',
  name: 'Brf Båda',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 10,
  locales: ['sv' as const, 'en' as const],
  rulesText: {sv: 'Städa efter dig.', en: 'Clean up after yourself.'},
};

function call(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  headers: {cookie: string},
  {
    language,
    payload,
  }: {language?: string; payload?: Record<string, unknown>} = {},
) {
  return server.inject({
    method,
    url,
    headers: {
      ...headers,
      ...(language === undefined ? {} : {'accept-language': language}),
    },
    payload,
  });
}

before(async () => {
  await assertTestDatabase();

  mail = memoryMail();
  server = await buildApp({
    logger: false,
    push: memoryPush(),
    mail: mail.send,
  });
  await resetDatabase();

  await seedOrganization({
    organization: BOTH,
    kinds: [{id: 'laundry', name: {sv: 'Tvätt', en: 'Laundry'}, maxActive: 1}],
    resources: [
      {
        id: 'both-laundry',
        kindId: 'laundry',
        name: {sv: 'Tvättstuga', en: 'Laundry room'},
        tags: {sv: ['torktumlare', 'mangel'], en: ['tumble dryer']},
        sortOrder: 1,
      },
      // Written before the organization took up English.
      {
        id: 'both-sauna',
        kindId: 'laundry',
        name: {sv: 'Bastu'},
        tags: {sv: ['handdukar']},
        sortOrder: 2,
      },
    ],
    slots: [{resourceId: 'both-laundry', start: '08:00', end: '12:00'}],
    apartments: ['1'],
    emailOf: (label) => `${label}@both.example.com`,
    adminEmail: 'admin@both.example.com',
  });
  await seedOrganization({
    organization: {
      id: 'swedish',
      name: 'Brf Svensk',
      timeZone: 'Europe/Stockholm',
      bookingWindowDays: 10,
    },
    kinds: [{id: 'laundry', name: {sv: 'Tvätt'}, maxActive: 1}],
    resources: [
      {
        id: 'swedish-laundry',
        kindId: 'laundry',
        name: {sv: 'Tvättstuga'},
        tags: {},
        sortOrder: 1,
      },
    ],
    slots: [],
    apartments: ['1'],
    emailOf: (label) => `${label}@swedish.example.com`,
    adminEmail: 'admin@swedish.example.com',
  });

  member = {cookie: (await signIn(server, '1@both.example.com')).cookie};
  admin = {cookie: (await signIn(server, 'admin@both.example.com')).cookie};
  swedishMember = {
    cookie: (await signIn(server, '1@swedish.example.com')).cookie,
  };
});

after(async () => {
  await server.close();
  await pool.end();
});

test('picks the first language asked for that the organization writes in', () => {
  assert.equal(resolveLocale(['de-DE', 'sv-SE', 'en'], ['sv', 'en']), 'sv');
  assert.equal(resolveLocale(['en-US;q=0.9'], ['sv', 'en']), 'en');
  assert.equal(resolveLocale(['de'], ['sv', 'en']), 'en');
  assert.equal(resolveLocale(['en'], ['sv']), 'sv');
  assert.equal(resolveLocale([], ['sv']), 'sv');
});

async function lastLocaleOf(email: string) {
  const [account] = await db
    .select({locale: user.locale, memberId: user.memberId})
    .from(user)
    .where(eq(user.email, email));
  return account;
}

test('remembers the language the device last showed, for mail', async () => {
  await call('GET', '/account', member, {language: 'en'});
  assert.equal((await lastLocaleOf('1@both.example.com'))?.locale, 'en');

  await call('GET', '/account', member, {language: 'sv-SE'});
  assert.equal((await lastLocaleOf('1@both.example.com'))?.locale, 'sv');

  // Neither a language the organization does not write in nor none at all
  // says what the device shows.
  await call('GET', '/account', member, {language: 'de'});
  await call('GET', '/account', member);
  assert.equal((await lastLocaleOf('1@both.example.com'))?.locale, 'sv');
});

test('a cancelled booking is mailed in the language the resident uses', async () => {
  await call('GET', '/account', member, {language: 'en'});
  const resident = await lastLocaleOf('1@both.example.com');
  const sent = mail.sent.length;

  await sendBookingsCancelled(
    BOTH.id,
    resident?.memberId ?? '',
    {sv: 'Tvättstuga', en: 'Laundry room'},
    [{date: '2026-10-10', start: '08:00', end: '12:00'}],
    {sv: 'Ny maskin', en: 'A new machine'},
  );

  const letter = mail.lastTo('1@both.example.com', sent);
  assert.equal(letter?.subject, 'Your booking in Brf Båda was cancelled');
  assert.match(letter?.text ?? '', /Laundry room, Saturday 10 October/);
  assert.match(letter?.text ?? '', /A new machine/);

  // Mail goes out without a request: a language the organization no
  // longer writes in falls back to its first.
  await db
    .update(user)
    .set({locale: 'en'})
    .where(eq(user.email, '1@swedish.example.com'));
  const swedish = await lastLocaleOf('1@swedish.example.com');
  await sendBookingsCancelled(
    'swedish',
    swedish?.memberId ?? '',
    {sv: 'Tvättstuga'},
    [{date: '2026-10-10', start: '08:00', end: '12:00'}],
    {},
  );
  assert.equal(
    mail.lastTo('1@swedish.example.com', sent)?.subject,
    'Din bokning i Brf Svensk har avbokats',
  );
});

test('tells the account which languages its organization writes in', async () => {
  const account = await call('GET', '/account', member);
  assert.deepEqual(account.json<Account>().locales, ['sv', 'en']);

  const swedish = await call('GET', '/account', swedishMember);
  assert.deepEqual(swedish.json<Account>().locales, ['sv']);
});

test("an apartment reads the organization's text in its device language", async () => {
  const english = await call('GET', '/resources', member, {language: 'en'});
  assert.deepEqual(
    english.json<Resource[]>().map(({name, tags}) => [name, tags]),
    [
      ['Laundry room', ['tumble dryer']],
      // Not yet translated, so shown as written.
      ['Bastu', ['handdukar']],
    ],
  );

  const swedish = await call('GET', '/resources', member, {language: 'sv'});
  assert.deepEqual(
    swedish.json<Resource[]>().map(({name, tags}) => [name, tags]),
    [
      ['Tvättstuga', ['torktumlare', 'mangel']],
      ['Bastu', ['handdukar']],
    ],
  );

  const rules = await call('GET', '/booking-rules', member, {language: 'en'});
  const {text, kinds} = rules.json<BookingRules>();
  assert.equal(text, 'Clean up after yourself.');
  assert.deepEqual(
    kinds.map((kind) => kind.name),
    ['Laundry'],
  );
});

test('a language the organization does not write in gets its own', async () => {
  const resources = await call('GET', '/resources', swedishMember, {
    language: 'en',
  });
  assert.deepEqual(
    resources.json<Resource[]>().map((resource) => resource.name),
    ['Tvättstuga'],
  );
});

test('the admin writes an announcement in every language, and only those', async () => {
  const missing = await call('POST', '/admin/announcements', admin, {
    payload: {title: {sv: 'Städdag'}, body: {sv: 'På lördag.'}, endsOn: null},
  });
  assert.equal(missing.statusCode, 409);
  assert.equal(codeOf(missing), 'LANGUAGES_CHANGED');

  const created = await call('POST', '/admin/announcements', admin, {
    payload: {
      title: {sv: 'Städdag', en: 'Clean-up day'},
      body: {sv: 'På lördag.', en: 'On Saturday.'},
      endsOn: null,
    },
  });
  assert.equal(created.statusCode, 201);

  const shown = await call('GET', '/announcements', member, {language: 'en'});
  assert.deepEqual(
    shown.json<Announcement[]>().map(({title, body}) => [title, body]),
    [['Clean-up day', 'On Saturday.']],
  );

  const view = await call('GET', '/admin/announcements', admin);
  assert.deepEqual(view.json<AdminAnnouncements>().announcements[0]?.title, {
    sv: 'Städdag',
    en: 'Clean-up day',
  });

  const swedishAdmin = {
    cookie: (await signIn(server, 'admin@swedish.example.com')).cookie,
  };
  const extra = await call('POST', '/admin/announcements', swedishAdmin, {
    payload: {
      title: {sv: 'Städdag', en: 'Clean-up day'},
      body: {sv: 'På lördag.', en: 'On Saturday.'},
      endsOn: null,
    },
  });
  assert.equal(codeOf(extra), 'LANGUAGES_CHANGED');

  await db.delete(announcements);
});

test('the admin names and tags a resource in every language', async () => {
  const kind = await call('POST', '/admin/kinds', admin, {
    payload: {name: {sv: 'Bastu', en: 'Sauna'}, maxActive: 1},
  });
  assert.equal(kind.statusCode, 201);
  const kindId = kind.json<{id: string}>().id;

  const untagged = await call('POST', '/admin/resources', admin, {
    payload: {
      name: {sv: 'Stora bastun', en: 'Big sauna'},
      kindId,
      tags: {sv: ['handdukar']},
      slots: [{start: '18:00', end: '20:00', endOffsetDays: 0}],
    },
  });
  assert.equal(codeOf(untagged), 'LANGUAGES_CHANGED');

  const created = await call('POST', '/admin/resources', admin, {
    payload: {
      name: {sv: 'Stora bastun', en: 'Big sauna'},
      kindId,
      tags: {sv: [], en: []},
      slots: [{start: '18:00', end: '20:00', endOffsetDays: 0}],
    },
  });
  assert.equal(created.statusCode, 201);
  const id = created.json<{id: string}>().id;

  const view = (
    await call('GET', '/admin/resources', admin)
  ).json<AdminResources>();
  const resource = view.resources.find((entry) => entry.id === id);
  assert.deepEqual(resource?.name, {sv: 'Stora bastun', en: 'Big sauna'});
  assert.deepEqual(resource?.tags, {});

  const renamed = await call('PATCH', `/admin/resources/${id}`, admin, {
    payload: {name: {sv: 'Bastun'}},
  });
  assert.equal(codeOf(renamed), 'LANGUAGES_CHANGED');
});

test('the admin changes the languages, and the rules follow', async () => {
  const withoutRules = await call('PATCH', '/admin/organization', admin, {
    payload: {locales: ['sv'], rulesText: {sv: 'Städa.', en: 'Clean up.'}},
  });
  assert.equal(codeOf(withoutRules), 'LANGUAGES_CHANGED');

  const saved = await call('PATCH', '/admin/organization', admin, {
    payload: {locales: ['en', 'sv', 'en']},
  });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.json<OrganizationSettings>().locales, ['sv', 'en']);

  const swedishOnly = await call('PATCH', '/admin/organization', admin, {
    payload: {locales: ['sv']},
  });
  // Turning English off keeps what is written in it.
  assert.deepEqual(swedishOnly.json<OrganizationSettings>().rulesText, {
    sv: 'Städa efter dig.',
    en: 'Clean up after yourself.',
  });

  const rules = await call('GET', '/booking-rules', member, {language: 'en'});
  assert.equal(rules.json<BookingRules>().text, 'Städa efter dig.');

  const none = await call('PATCH', '/admin/organization', admin, {
    payload: {locales: []},
  });
  assert.equal(codeOf(none), 'VALIDATION');

  const cleared = await call('PATCH', '/admin/organization', admin, {
    payload: {locales: ['sv', 'en'], rulesText: {sv: ' ', en: ''}},
  });
  assert.deepEqual(cleared.json<OrganizationSettings>().rulesText, {});
});

test('push names a resource not yet translated as it is written', () => {
  const slot = {
    date: '2026-10-10',
    start: '07:00',
    end: '10:00',
    resourceId: 'both-laundry',
    resourceName: {sv: 'Tvättstuga'},
  };

  assert.equal(
    releasedNotification('en', slot).body,
    'Tvättstuga, Saturday 10 October 07:00–10:00 is free – first come, first served.',
  );
});
