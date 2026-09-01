import 'dotenv/config';

import {db, pool} from '../src/db/index.js';
import {
  bookings,
  resources,
  subscriptions,
  timeSlots,
} from '../src/db/schema.js';
import {slotEndsAt, toIsoDate} from '../src/lib/time.js';

const CURRENT_APARTMENT = '12';

const RESOURCES = [
  {
    id: 'laundry-1',
    name: 'Tvättstuga 1',
    kind: 'laundry' as const,
    hasDryer: true,
    sortOrder: 1,
  },
  {
    id: 'laundry-2',
    name: 'Tvättstuga 2',
    kind: 'laundry' as const,
    hasDryer: false,
    sortOrder: 2,
  },
  {
    id: 'drying-room',
    name: 'Torkrum',
    kind: 'drying' as const,
    hasDryer: false,
    sortOrder: 3,
  },
];

const LAUNDRY_TIME_SLOTS = [
  {id: '07-10', start: '07:00', end: '10:00'},
  {id: '10-13', start: '10:00', end: '13:00'},
  {id: '13-16', start: '13:00', end: '16:00'},
  {id: '16-19', start: '16:00', end: '19:00'},
  {id: '19-22', start: '19:00', end: '22:00'},
];

const SEEDED_BOOKINGS = [
  {
    days: -1,
    slotId: '19-22',
    userId: CURRENT_APARTMENT,
    resourceId: 'laundry-1',
  },
  {days: 0, slotId: '10-13', userId: '21', resourceId: 'laundry-1'},
  {days: 0, slotId: '16-19', userId: '14', resourceId: 'laundry-2'},
  {
    days: 1,
    slotId: '07-10',
    userId: CURRENT_APARTMENT,
    resourceId: 'laundry-1',
  },
  {days: 1, slotId: '13-16', userId: '23', resourceId: 'laundry-1'},
  {
    days: 1,
    slotId: '10-13',
    userId: CURRENT_APARTMENT,
    resourceId: 'drying-room',
  },
  {days: 2, slotId: '19-22', userId: '31', resourceId: 'laundry-2'},
];

const SEEDED_SUBSCRIPTIONS = [
  {
    days: 0,
    slotId: '16-19',
    userId: CURRENT_APARTMENT,
    resourceId: 'laundry-2',
  },
  {days: 1, slotId: '07-10', userId: '31', resourceId: 'laundry-1'},
  {
    days: 1,
    slotId: '13-16',
    userId: CURRENT_APARTMENT,
    resourceId: 'laundry-1',
  },
  {days: 2, slotId: '19-22', userId: '14', resourceId: 'laundry-2'},
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
    .insert(resources)
    .values([...RESOURCES])
    .onConflictDoNothing();
  await db
    .insert(timeSlots)
    .values([...LAUNDRY_TIME_SLOTS])
    .onConflictDoNothing();

  await db.delete(subscriptions);
  await db.delete(bookings);

  await db.insert(bookings).values(
    SEEDED_BOOKINGS.map(({days, slotId, userId, resourceId}) => {
      const date = dateDaysFromToday(days);
      return {
        date,
        slotId,
        resourceId,
        userId,
        endsAt: slotEndsAt(date, slotEnd(slotId)),
      };
    }),
  );

  await db.insert(subscriptions).values(
    SEEDED_SUBSCRIPTIONS.map(({days, slotId, userId, resourceId}) => {
      const date = dateDaysFromToday(days);
      return {
        date,
        slotId,
        resourceId,
        userId,
        endsAt: slotEndsAt(date, slotEnd(slotId)),
      };
    }),
  );

  console.log('Seed complete');
} finally {
  await pool.end();
}
