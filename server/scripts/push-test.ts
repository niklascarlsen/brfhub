import 'dotenv/config';

import {and, asc, eq, isNull, ne, not} from 'drizzle-orm';

import {db, pool} from '../src/db/index.js';
import {
  bookings,
  members,
  organizations,
  pushTokens,
  resources,
  user,
} from '../src/db/schema.js';
import {localize} from '../src/lib/locale.js';
import {slotHasStarted} from '../src/lib/time.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
// npm run push:test -- [organization] [watching apartment]
const ORGANIZATION_ID = process.argv[2] ?? 'demo';
const WATCHER = process.argv[3] ?? '12';
// The accounts seed.ts creates.
const PASSWORD = 'password';

const sessions = new Map<string, string>();

async function emailOf(apartment: string): Promise<string> {
  const [row] = await db
    .select({email: user.email})
    .from(user)
    .innerJoin(members, eq(members.id, user.memberId))
    .where(
      and(
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.label, apartment),
      ),
    );

  if (!row) {
    throw new Error(
      `No account for apartment ${apartment} in ${ORGANIZATION_ID}`,
    );
  }

  return row.email;
}

async function signIn(apartment: string): Promise<string> {
  const known = sessions.get(apartment);

  if (known) {
    return known;
  }

  // Better Auth refuses a POST without an Origin, which fetch does not set.
  const response = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: process.env.WEB_ORIGIN ?? API_URL,
    },
    body: JSON.stringify({
      email: await emailOf(apartment),
      password: PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `sign-in as ${apartment} → ${response.status} ${await response.text()}`,
    );
  }

  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
  sessions.set(apartment, cookie);

  return cookie;
}

async function request(
  path: string,
  apartment: string,
  init: RequestInit = {},
): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body === undefined ? {} : {'content-type': 'application/json'}),
      cookie: await signIn(apartment),
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${response.status} ${await response.text()}`,
    );
  }
}

function findReleasableBooking() {
  return db
    .select({
      id: bookings.id,
      owner: members.label,
      date: bookings.date,
      start: bookings.start,
      end: bookings.end,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
    })
    .from(bookings)
    .innerJoin(members, eq(members.id, bookings.memberId))
    .innerJoin(resources, eq(resources.id, bookings.resourceId))
    .innerJoin(organizations, eq(organizations.id, bookings.organizationId))
    .where(
      and(
        eq(bookings.organizationId, ORGANIZATION_ID),
        isNull(bookings.releasedAt),
        ne(members.label, WATCHER),
        not(
          slotHasStarted(organizations.timeZone, bookings.date, bookings.start),
        ),
      ),
    )
    .orderBy(asc(bookings.date), asc(bookings.start))
    .limit(1)
    .then((rows) => rows[0]);
}

function countTokens() {
  return db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .innerJoin(members, eq(members.id, pushTokens.memberId))
    .where(
      and(
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.label, WATCHER),
      ),
    )
    .then((rows) => rows.length);
}

try {
  const booking = await findReleasableBooking();

  if (!booking) {
    console.log('No upcoming booking held by another apartment.');
    console.log('Run npm run db:seed and try again.');
    process.exit(1);
  }

  const {id, owner, date, start, end, resourceId} = booking;
  const resourceName = localize(booking.resourceName, 'en');
  console.log(
    `1. apartment ${owner} holds ${resourceName} ${date} ${start}–${end}`,
  );

  await request('/subscriptions', WATCHER, {
    method: 'POST',
    body: JSON.stringify({date, start, resourceId}),
  });
  console.log(`2. apartment ${WATCHER} is watching it`);

  const tokens = await countTokens();

  await request(`/bookings/${id}`, owner, {method: 'DELETE'});
  console.log(`3. apartment ${owner} released it`);
  console.log('');

  if (tokens === 0) {
    console.log(`No push token for apartment ${WATCHER}.`);
    console.log('Restart the app so it registers one, then run this again.');
  } else {
    console.log(
      `Released for ${tokens} device token(s). The server sends push after answering, so watch the emulator, and the server log if nothing comes.`,
    );
  }
} finally {
  await pool.end();
}
