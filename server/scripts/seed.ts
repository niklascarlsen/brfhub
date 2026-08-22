import 'dotenv/config';

import {db, pool} from '../src/db/index.js';
import {bookings, timeSlots} from '../src/db/schema.js';
import {slotEndsAt, toIsoDate} from '../src/lib/time.js';

const CURRENT_USER_ID = 'me';
const OTHER_USER_ID = 'neighbour';

const LAUNDRY_TIME_SLOTS = [
  {id: '07-10', start: '07:00', end: '10:00'},
  {id: '10-13', start: '10:00', end: '13:00'},
  {id: '13-16', start: '13:00', end: '16:00'},
  {id: '16-19', start: '16:00', end: '19:00'},
  {id: '19-22', start: '19:00', end: '22:00'},
];

const SEEDED_BOOKINGS = [
  {days: -1, slotId: '19-22', userId: CURRENT_USER_ID},
  {days: 0, slotId: '16-19', userId: OTHER_USER_ID},
  {days: 1, slotId: '10-13', userId: OTHER_USER_ID},
];

function dateDaysFromToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function slotEnd(slotId: string): string {
  const slot = LAUNDRY_TIME_SLOTS.find((item) => item.id === slotId);
  if (!slot) {
    throw new Error(`Unknown slot ${slotId}`);
  }
  return slot.end;
}

try {
  await db
    .insert(timeSlots)
    .values([...LAUNDRY_TIME_SLOTS])
    .onConflictDoNothing();

  await db
    .insert(bookings)
    .values(
      SEEDED_BOOKINGS.map(({days, slotId, userId}) => {
        const date = dateDaysFromToday(days);
        return {date, slotId, userId, endsAt: slotEndsAt(date, slotEnd(slotId))};
      }),
    )
    .onConflictDoNothing();

  console.log('Seed complete');
} finally {
  await pool.end();
}
