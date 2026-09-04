import 'dotenv/config';

import {and, eq} from 'drizzle-orm';

import {db, pool} from '../src/db/index.js';
import {members, pushTokens} from '../src/db/schema.js';
import {toIsoDate} from '../src/lib/time.js';
import {ORGANIZATION_ID} from '../src/lib/user.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const WATCHER = '12';
const OWNERS = ['21', '23', '31', '14'];

type Resource = {id: string; name: string};
type Slot = {start: string; end: string; status: string};
type Booking = {id: string};

async function request<T>(
  path: string,
  apartment: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body === undefined ? {} : {'content-type': 'application/json'}),
      'x-apartment-number': apartment,
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${init.method ?? 'GET'} ${path} → ${response.status} ${body}`,
    );
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

function datesAhead(days: number): string[] {
  const dates = Array.from({length: days}, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index + 1);
    return toIsoDate(date);
  });

  return dates.sort(() => Math.random() - 0.5);
}

async function findFreeSlot(resources: Resource[]) {
  for (const date of datesAhead(14)) {
    for (const resource of resources) {
      const {slots} = await request<{slots: Slot[]}>(
        `/slots?date=${date}&resourceId=${resource.id}`,
        WATCHER,
      );
      const free = slots.find((slot) => slot.status === 'available');

      if (free) {
        return {date, resource, start: free.start, end: free.end};
      }
    }
  }

  throw new Error('No free slot within the booking window');
}

async function bookAsAnyone(
  date: string,
  resourceId: string,
  start: string,
): Promise<{owner: string; booking: Booking}> {
  for (const owner of OWNERS) {
    try {
      const booking = await request<Booking>('/bookings', owner, {
        method: 'POST',
        body: JSON.stringify({date, start, resourceId}),
      });

      return {owner, booking};
    } catch {
      continue;
    }
  }

  throw new Error('Every candidate apartment already holds a booking');
}

async function countTokens(): Promise<number> {
  const rows = await db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .innerJoin(members, eq(members.id, pushTokens.memberId))
    .where(
      and(
        eq(members.organizationId, ORGANIZATION_ID),
        eq(members.label, WATCHER),
      ),
    );

  return rows.length;
}

try {
  const resources = await request<Resource[]>('/resources', WATCHER);
  const {date, resource, start, end} = await findFreeSlot(resources);

  const {owner, booking} = await bookAsAnyone(date, resource.id, start);
  console.log(
    `1. apartment ${owner} booked ${resource.name} ${date} ${start}–${end}`,
  );

  await request('/subscriptions', WATCHER, {
    method: 'POST',
    body: JSON.stringify({date, start, resourceId: resource.id}),
  });
  console.log(`2. apartment ${WATCHER} is watching the same slot`);

  const tokens = await countTokens();

  await request(`/bookings/${booking.id}`, owner, {method: 'DELETE'});
  console.log(`3. apartment ${owner} released it`);

  if (tokens === 0) {
    console.log('');
    console.log(`No push token registered for apartment ${WATCHER}.`);
  } else {
    console.log('');
    console.log(`Sent to ${tokens} device token(s).`);
  }
} finally {
  await pool.end();
}
