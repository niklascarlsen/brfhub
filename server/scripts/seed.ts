import 'dotenv/config';

import {eq} from 'drizzle-orm';

import {db, pool} from '../src/db/index.js';
import {
  bookings,
  members,
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
  subscriptions,
} from '../src/db/schema.js';
import {slotEndsAt, toIsoDate} from '../src/lib/time.js';
import {ORGANIZATION_ID} from '../src/lib/user.js';

const CURRENT_APARTMENT = '12';

const ORGANIZATION = {
  id: ORGANIZATION_ID,
  name: 'Brf Exempel',
  bookingWindowDays: 30,
};

const KINDS = [
  {organizationId: ORGANIZATION_ID, id: 'laundry', name: 'Tvätt', maxActive: 1},
  {organizationId: ORGANIZATION_ID, id: 'drying', name: 'Tork', maxActive: 1},
];

const APARTMENTS = ['12', '14', '21', '23', '31'];

const RESOURCES = [
  {
    id: 'laundry-1',
    organizationId: ORGANIZATION_ID,
    kindId: 'laundry',
    name: 'Tvättstuga 1',
    tags: ['torktumlare'],
    sortOrder: 1,
  },
  {
    id: 'laundry-2',
    organizationId: ORGANIZATION_ID,
    kindId: 'laundry',
    name: 'Tvättstuga 2',
    tags: [],
    sortOrder: 2,
  },
  {
    id: 'drying-room',
    organizationId: ORGANIZATION_ID,
    kindId: 'drying',
    name: 'Torkrum',
    tags: [],
    sortOrder: 3,
  },
];

type SlotSpec = {start: string; end: string; endOffsetDays?: number};

const LAUNDRY_SLOTS: SlotSpec[] = [
  {start: '07:00', end: '10:00'},
  {start: '10:00', end: '13:00'},
  {start: '13:00', end: '16:00'},
  {start: '16:00', end: '19:00'},
  {start: '19:00', end: '22:00'},
];

const DRYING_SLOTS: SlotSpec[] = [
  {start: '08:00', end: '14:00'},
  {start: '14:00', end: '20:00'},
  {start: '20:00', end: '08:00', endOffsetDays: 1},
];

const RESOURCE_SLOTS = [
  ...LAUNDRY_SLOTS.map((slot) => ({...slot, resourceId: 'laundry-1'})),
  ...LAUNDRY_SLOTS.map((slot) => ({...slot, resourceId: 'laundry-2'})),
  ...DRYING_SLOTS.map((slot) => ({...slot, resourceId: 'drying-room'})),
];

const SEEDED_BOOKINGS = [
  {days: -1, start: '19:00', label: CURRENT_APARTMENT, resourceId: 'laundry-1'},
  {days: 0, start: '10:00', label: '21', resourceId: 'laundry-1'},
  {days: 0, start: '16:00', label: '14', resourceId: 'laundry-2'},
  {days: 1, start: '07:00', label: CURRENT_APARTMENT, resourceId: 'laundry-1'},
  {days: 1, start: '13:00', label: '23', resourceId: 'laundry-1'},
  {
    days: 1,
    start: '08:00',
    label: CURRENT_APARTMENT,
    resourceId: 'drying-room',
  },
  {days: 2, start: '19:00', label: '31', resourceId: 'laundry-2'},
  {days: 1, start: '20:00', label: '23', resourceId: 'drying-room'},
];

const SEEDED_SUBSCRIPTIONS = [
  {days: 0, start: '16:00', label: CURRENT_APARTMENT, resourceId: 'laundry-2'},
  {days: 1, start: '07:00', label: '31', resourceId: 'laundry-1'},
  {days: 1, start: '13:00', label: CURRENT_APARTMENT, resourceId: 'laundry-1'},
  {days: 2, start: '19:00', label: '14', resourceId: 'laundry-2'},
];

function dateDaysFromToday(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function findSlot(resourceId: string, start: string) {
  const slot = RESOURCE_SLOTS.find(
    (item) => item.resourceId === resourceId && item.start === start,
  );

  if (!slot) {
    throw new Error(`Unknown slot ${resourceId} ${start}`);
  }

  return slot;
}

try {
  await db.insert(organizations).values(ORGANIZATION).onConflictDoNothing();
  await db.insert(resourceKinds).values(KINDS).onConflictDoNothing();
  await db
    .insert(members)
    .values(
      APARTMENTS.map((label) => ({organizationId: ORGANIZATION_ID, label})),
    )
    .onConflictDoNothing();
  await db.insert(resources).values(RESOURCES).onConflictDoNothing();
  await db.insert(resourceSlots).values(RESOURCE_SLOTS).onConflictDoNothing();

  const memberRows = await db
    .select({id: members.id, label: members.label})
    .from(members)
    .where(eq(members.organizationId, ORGANIZATION_ID));

  const memberIds = new Map(memberRows.map((row) => [row.label, row.id]));

  function memberId(label: string): string {
    const id = memberIds.get(label);
    if (!id) {
      throw new Error(`Unknown member ${label}`);
    }
    return id;
  }

  await db.delete(subscriptions);
  await db.delete(bookings);

  function toRow({
    days,
    start,
    label,
    resourceId,
  }: {
    days: number;
    start: string;
    label: string;
    resourceId: string;
  }) {
    const date = dateDaysFromToday(days);
    const slot = findSlot(resourceId, start);

    return {
      organizationId: ORGANIZATION_ID,
      memberId: memberId(label),
      date,
      start,
      end: slot.end,
      resourceId,
      endsAt: slotEndsAt(date, slot.end, slot.endOffsetDays),
    };
  }

  await db.insert(bookings).values(SEEDED_BOOKINGS.map(toRow));
  await db.insert(subscriptions).values(SEEDED_SUBSCRIPTIONS.map(toRow));

  console.log('Seed complete');
} finally {
  await pool.end();
}
