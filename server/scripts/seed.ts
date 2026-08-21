import 'dotenv/config';

import {db, pool} from '../src/db/index.js';
import {bookings, timeSlots} from '../src/db/schema.js';

const CURRENT_USER_ID = 'me';
const OTHER_USER_ID = 'neighbour';

const LAUNDRY_TIME_SLOTS = [
  {id: '07-10', start: '07:00', end: '10:00'},
  {id: '10-13', start: '10:00', end: '13:00'},
  {id: '13-16', start: '13:00', end: '16:00'},
  {id: '16-19', start: '16:00', end: '19:00'},
  {id: '19-22', start: '19:00', end: '22:00'},
];

function dateKeyDaysFromToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

try {
  await db
    .insert(timeSlots)
    .values([...LAUNDRY_TIME_SLOTS])
    .onConflictDoNothing();

  await db
    .insert(bookings)
    .values([
      {date: dateKeyDaysFromToday(0), slotId: '07-10', userId: CURRENT_USER_ID},
      {date: dateKeyDaysFromToday(0), slotId: '16-19', userId: OTHER_USER_ID},
      {date: dateKeyDaysFromToday(1), slotId: '10-13', userId: OTHER_USER_ID},
      {date: dateKeyDaysFromToday(3), slotId: '19-22', userId: CURRENT_USER_ID},
    ])
    .onConflictDoNothing();

  console.log('Seed complete');
} finally {
  await pool.end();
}
