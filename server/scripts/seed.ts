import 'dotenv/config';

import {and, eq, inArray} from 'drizzle-orm';

import {createUser} from '../src/auth/auth.service.js';
import {db, pool} from '../src/db/index.js';
import {
  bookings,
  members,
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
  subscriptions,
  user,
} from '../src/db/schema.js';
import {slotEndsAt, toIsoDate} from '../src/lib/time.js';

const ORGANIZATION_ID = 'demo';
const OTHER_ORGANIZATION_ID = 'andra';
const CURRENT_APARTMENT = '12';
// Every account signs in with this password: apartments in Brf Exempel as
// <apartment>@example.com, in Brf Andra as <apartment>@andra.example.com,
// and each admin as admin@ on the same domain.
const PASSWORD = 'password';

const ORGANIZATION = {
  id: ORGANIZATION_ID,
  name: 'Brf Exempel',
  bookingWindowDays: 30,
};

const KINDS = [
  {organizationId: ORGANIZATION_ID, id: 'laundry', name: 'Tvätt', maxActive: 1},
  {organizationId: ORGANIZATION_ID, id: 'drying', name: 'Tork', maxActive: 1},
  {organizationId: ORGANIZATION_ID, id: 'sauna', name: 'Bastu', maxActive: 1},
  {organizationId: ORGANIZATION_ID, id: 'hobby', name: 'Hobby', maxActive: 1},
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
  {
    id: 'sauna',
    organizationId: ORGANIZATION_ID,
    kindId: 'sauna',
    name: 'Bastu',
    tags: ['max 4 personer'],
    sortOrder: 4,
  },
  {
    id: 'workshop',
    organizationId: ORGANIZATION_ID,
    kindId: 'hobby',
    name: 'Snickerirum',
    tags: [],
    sortOrder: 5,
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

const SAUNA_SLOTS: SlotSpec[] = [
  {start: '17:00', end: '19:00'},
  {start: '19:00', end: '21:00'},
];

const WORKSHOP_SLOTS: SlotSpec[] = [
  {start: '10:00', end: '15:00'},
  {start: '15:00', end: '20:00'},
];

const RESOURCE_SLOTS = [
  ...LAUNDRY_SLOTS.map((slot) => ({...slot, resourceId: 'laundry-1'})),
  ...LAUNDRY_SLOTS.map((slot) => ({...slot, resourceId: 'laundry-2'})),
  ...DRYING_SLOTS.map((slot) => ({...slot, resourceId: 'drying-room'})),
  ...SAUNA_SLOTS.map((slot) => ({...slot, resourceId: 'sauna'})),
  ...WORKSHOP_SLOTS.map((slot) => ({...slot, resourceId: 'workshop'})),
];

// A second organization, so every screen shows that nothing leaks between
// them. Resource ids are global until they become uuids, hence the prefix.
const OTHER_ORGANIZATION = {
  id: OTHER_ORGANIZATION_ID,
  name: 'Brf Andra',
  bookingWindowDays: 14,
};

const OTHER_KINDS = [
  {
    organizationId: OTHER_ORGANIZATION_ID,
    id: 'laundry',
    name: 'Tvätt',
    maxActive: 1,
  },
  {
    organizationId: OTHER_ORGANIZATION_ID,
    id: 'guest',
    name: 'Gästlägenhet',
    maxActive: 1,
  },
];

const OTHER_APARTMENTS = ['1001', '1002', '1101', '1102'];

// Who the admin sees living in each apartment.
const RESIDENTS: Record<string, string> = {
  '12': 'Anna och Erik Lind',
  '14': 'Johan Berg',
  '21': 'Fatima Ali',
  '23': 'Maria och Per Holm',
  '31': 'Lena Ek',
  '1001': 'Oskar Nyberg',
  '1002': 'Sofia Ström',
  '1101': 'Ahmed och Lina Haddad',
  '1102': 'Karin Sjö',
};

const OTHER_RESOURCES = [
  {
    id: 'andra-laundry',
    organizationId: OTHER_ORGANIZATION_ID,
    kindId: 'laundry',
    name: 'Tvättstugan',
    tags: [],
    sortOrder: 1,
  },
  {
    id: 'andra-guest',
    organizationId: OTHER_ORGANIZATION_ID,
    kindId: 'guest',
    name: 'Gästlägenheten',
    tags: ['4 bäddar'],
    sortOrder: 2,
  },
];

const OTHER_RESOURCE_SLOTS = [
  ...[
    {start: '08:00', end: '12:00'},
    {start: '12:00', end: '16:00'},
    {start: '16:00', end: '20:00'},
  ].map((slot) => ({...slot, resourceId: 'andra-laundry'})),
  {start: '15:00', end: '11:00', endOffsetDays: 1, resourceId: 'andra-guest'},
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
  // Only the two seeded organizations start over: one made with
  // org:create keeps its admin, whose password was shown only once.
  const seeded = [ORGANIZATION_ID, OTHER_ORGANIZATION_ID];
  await db.transaction(async (tx) => {
    await tx.delete(bookings).where(inArray(bookings.organizationId, seeded));
    await tx
      .delete(subscriptions)
      .where(inArray(subscriptions.organizationId, seeded));
    await tx
      .delete(resourceSlots)
      .where(
        inArray(
          resourceSlots.resourceId,
          tx
            .select({id: resources.id})
            .from(resources)
            .where(inArray(resources.organizationId, seeded)),
        ),
      );
    await tx.delete(resources).where(inArray(resources.organizationId, seeded));
    await tx
      .delete(resourceKinds)
      .where(inArray(resourceKinds.organizationId, seeded));
    // Sessions and credential accounts go with their user.
    await tx.delete(user).where(inArray(user.organizationId, seeded));
  });

  await db
    .insert(organizations)
    .values([ORGANIZATION, OTHER_ORGANIZATION])
    .onConflictDoNothing();
  await db
    .insert(members)
    .values([
      ...APARTMENTS.map((label) => ({organizationId: ORGANIZATION_ID, label})),
      ...OTHER_APARTMENTS.map((label) => ({
        organizationId: OTHER_ORGANIZATION_ID,
        label,
      })),
    ])
    .onConflictDoNothing();
  await db.insert(resourceKinds).values([...KINDS, ...OTHER_KINDS]);
  await db.insert(resources).values([...RESOURCES, ...OTHER_RESOURCES]);
  await db.insert(resourceSlots).values(
    [...RESOURCE_SLOTS, ...OTHER_RESOURCE_SLOTS].map((slot) => ({
      ...slot,
      validFrom: '2000-01-01',
    })),
  );

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

  for (const label of APARTMENTS) {
    await createUser({
      email: `${label}@example.com`,
      password: PASSWORD,
      name: RESIDENTS[label] ?? `Lägenhet ${label}`,
      organizationId: ORGANIZATION_ID,
      role: 'member',
      memberId: memberId(label),
    });
  }

  const otherMembers = await db
    .select({id: members.id, label: members.label})
    .from(members)
    .where(
      and(
        eq(members.organizationId, OTHER_ORGANIZATION_ID),
        inArray(members.label, OTHER_APARTMENTS),
      ),
    );

  for (const {id, label} of otherMembers) {
    await createUser({
      email: `${label}@andra.example.com`,
      password: PASSWORD,
      name: RESIDENTS[label] ?? `Lägenhet ${label}`,
      organizationId: OTHER_ORGANIZATION_ID,
      role: 'member',
      memberId: id,
    });
  }

  await createUser({
    email: 'admin@example.com',
    password: PASSWORD,
    name: `Admin ${ORGANIZATION.name}`,
    organizationId: ORGANIZATION_ID,
    role: 'admin',
  });
  await createUser({
    email: 'admin@andra.example.com',
    password: PASSWORD,
    name: `Admin ${OTHER_ORGANIZATION.name}`,
    organizationId: OTHER_ORGANIZATION_ID,
    role: 'admin',
  });

  console.log('Seed complete');
} finally {
  await pool.end();
}
