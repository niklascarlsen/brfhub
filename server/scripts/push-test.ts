import 'dotenv/config';

import {and, asc, eq, isNull, ne, not} from 'drizzle-orm';

import {db, pool} from '../src/db/index.js';
import {bookings, members, pushTokens, resources} from '../src/db/schema.js';
import {slotHasStarted} from '../src/lib/time.js';
import {ORGANIZATION_ID} from '../src/lib/user.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const WATCHER = '12';

async function request(
  path: string,
  apartment: string,
  init: RequestInit = {},
): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body === undefined ? {} : {'content-type': 'application/json'}),
      'x-apartment-number': apartment,
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
    .where(
      and(
        eq(bookings.organizationId, ORGANIZATION_ID),
        isNull(bookings.releasedAt),
        ne(members.label, WATCHER),
        not(slotHasStarted(bookings.date, bookings.start)),
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

  const {id, owner, date, start, end, resourceId, resourceName} = booking;
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
    console.log(`Sent to ${tokens} device token(s). Watch the emulator.`);
  }
} finally {
  await pool.end();
}
