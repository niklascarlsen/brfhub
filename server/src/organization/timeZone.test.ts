import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';

import {buildApp} from '../app.js';
import type {AdminAnnouncements} from '../announcement/announcement.dto.js';
import type {Apartment} from '../apartment/apartment.dto.js';
import {pool} from '../db/index.js';
import {isoDateIn} from '../lib/time.js';
import type {BookingWindow, Slots} from '../slot/slot.dto.js';
import {
  assertTestDatabase,
  codeOf,
  resetDatabase,
  seedOrganization,
  signIn,
} from '../test/fixtures.js';

// UTC+14 and UTC-11 all year, so whatever the clock says, the east is a
// day or two ahead of the west and the tests below hold.
const EAST = {
  id: 'east',
  name: 'Brf Öst',
  timeZone: 'Pacific/Kiritimati',
  bookingWindowDays: 10,
};
const WEST = {
  id: 'west',
  name: 'Brf Väst',
  timeZone: 'Pacific/Pago_Pago',
  bookingWindowDays: 10,
};
const ALL_DAY = {start: '00:00', end: '00:00', endOffsetDays: 1};

type Side = {
  organization: typeof EAST;
  resourceId: string;
  member: {cookie: string};
  admin: {cookie: string};
};

let server: Awaited<ReturnType<typeof buildApp>>;
const sides = new Map<string, Side>();

function side(organization: typeof EAST): Side {
  const found = sides.get(organization.id);

  if (!found) {
    throw new Error(`No ${organization.id} organization`);
  }

  return found;
}

function call(
  method: 'GET' | 'POST',
  url: string,
  headers: {cookie: string},
  payload?: Record<string, unknown>,
) {
  return server.inject({method, url, headers, payload});
}

async function windowOf({member}: Side) {
  return (await call('GET', '/booking-window', member)).json<BookingWindow>();
}

async function slotOn({member, resourceId}: Side, date: string) {
  const response = await call(
    'GET',
    `/slots?date=${date}&resourceId=${resourceId}`,
    member,
  );

  return response.json<Slots>().slots.find((slot) => slot.date === date);
}

before(async () => {
  await assertTestDatabase();

  server = await buildApp({logger: false});
  await resetDatabase();

  for (const organization of [EAST, WEST]) {
    const resourceId = `${organization.id}-laundry`;
    const emailOf = (label: string) =>
      `${label}@${organization.id}.example.com`;
    const adminEmail = `admin@${organization.id}.example.com`;

    await seedOrganization({
      organization,
      kinds: [{id: 'laundry', name: {sv: 'Tvätt'}, maxActive: 1}],
      resources: [
        {
          id: resourceId,
          kindId: 'laundry',
          name: {sv: 'Tvättstuga'},
          tags: {},
          sortOrder: 1,
        },
      ],
      slots: [{...ALL_DAY, resourceId}],
      apartments: ['1'],
      emailOf,
      adminEmail,
    });

    sides.set(organization.id, {
      organization,
      resourceId,
      member: {cookie: (await signIn(server, emailOf('1'))).cookie},
      admin: {cookie: (await signIn(server, adminEmail)).cookie},
    });
  }
});

after(async () => {
  await server.close();
  await pool.end();
});

test('each organization books from its own today', async () => {
  const east = await windowOf(side(EAST));
  const west = await windowOf(side(WEST));

  assert.equal(east.today, isoDateIn(EAST.timeZone));
  assert.equal(west.today, isoDateIn(WEST.timeZone));
  assert.ok(east.today > west.today);
});

test('a slot that has started in the east is still ahead in the west', async () => {
  const day = (await windowOf(side(EAST))).today;

  assert.equal((await slotOn(side(EAST), day))?.status, 'walkin');
  const late = await call('POST', '/bookings', side(EAST).member, {
    date: day,
    start: ALL_DAY.start,
    resourceId: side(EAST).resourceId,
  });
  assert.equal(late.statusCode, 400);
  assert.equal(codeOf(late), 'SLOT_STARTED');

  assert.equal((await slotOn(side(WEST), day))?.status, 'available');
  const early = await call('POST', '/bookings', side(WEST).member, {
    date: day,
    start: ALL_DAY.start,
    resourceId: side(WEST).resourceId,
  });
  assert.equal(early.statusCode, 201);
});

test('an announcement is dated today where it is published', async () => {
  for (const organization of [EAST, WEST]) {
    const {admin} = side(organization);
    const created = await call('POST', '/admin/announcements', admin, {
      title: {sv: 'Städdag'},
      body: {sv: 'På lördag.'},
      endsOn: null,
    });
    assert.equal(created.statusCode, 201);

    const view = (
      await call('GET', '/admin/announcements', admin)
    ).json<AdminAnnouncements>();
    assert.equal(view.today, isoDateIn(organization.timeZone));
    assert.deepEqual(
      view.announcements.map((item) => item.publishedOn),
      [isoDateIn(organization.timeZone)],
    );
  }
});

test('the admin sees the last sign-in on the organization’s day', async () => {
  for (const organization of [EAST, WEST]) {
    const [apartment] = (
      await call('GET', '/admin/apartments', side(organization).admin)
    ).json<Apartment[]>();

    assert.equal(apartment?.lastSignInOn, isoDateIn(organization.timeZone));
  }
});
