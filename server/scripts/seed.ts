import 'dotenv/config';

import {generateRandomString} from 'better-auth/crypto';
import {and, eq, inArray} from 'drizzle-orm';

import {createUser, enrollTwoFactor} from '../src/auth/auth.service.js';
import {db, pool} from '../src/db/index.js';
import {
  announcements,
  bookings,
  members,
  organizations,
  resourceKinds,
  resourceSlots,
  resources,
  subscriptions,
  user,
} from '../src/db/schema.js';
import type {Locale} from '../src/lib/locale.js';
import {addDays, isoDateIn, slotEndsAt} from '../src/lib/time.js';

const ORGANIZATION_ID = 'demo';
const OTHER_ORGANIZATION_ID = 'andra';
const CURRENT_APARTMENT = '12';
// Apartments sign in with a code from their mail, in Brf Exempel as
// <apartment>@example.com and in Brf Andra as <apartment>@andra.example.com.
// Each admin signs in as admin@ on the same domain with this password, as
// does the board member who lives in BOARD_APARTMENT and is both. Their
// authenticator is set up already: npm run totp -- <email> prints the code.
const PASSWORD = 'password';
const BOARD_APARTMENT = '31';
const BOARD_EMAIL = 'styrelse@example.com';

// Writes in Swedish and English, so its apartments can pick either.
const ORGANIZATION = {
  id: ORGANIZATION_ID,
  name: 'Brf Exempel',
  timeZone: 'Europe/Stockholm',
  bookingWindowDays: 30,
  locales: ['sv', 'en'] satisfies Locale[],
  rulesText: {
    sv: [
      'Lämna tvättstugan städad och torka av maskinerna efter dig.',
      'Är du sen mer än 30 minuter får nästa på tur ta över din tid.',
      'Bastun är rökfri, och barn badar bara med en vuxen.',
    ].join('\n\n'),
    en: [
      'Leave the laundry room clean and wipe the machines after you.',
      'If you are more than 30 minutes late, the next in line may take your slot.',
      'The sauna is smoke-free, and children bathe only with an adult.',
    ].join('\n\n'),
  },
};

const KINDS = [
  {
    organizationId: ORGANIZATION_ID,
    id: 'laundry',
    name: {sv: 'Tvätt', en: 'Laundry'},
    maxActive: 1,
  },
  {
    organizationId: ORGANIZATION_ID,
    id: 'drying',
    name: {sv: 'Tork', en: 'Drying'},
    maxActive: 1,
  },
  {
    organizationId: ORGANIZATION_ID,
    id: 'sauna',
    name: {sv: 'Bastu', en: 'Sauna'},
    maxActive: 1,
  },
  {
    organizationId: ORGANIZATION_ID,
    id: 'hobby',
    name: {sv: 'Hobby', en: 'Hobby'},
    // Two at a time, so a third asks which of the two to swap.
    maxActive: 2,
  },
];

const APARTMENTS = ['12', '14', '21', '23', '31'];

const RESOURCES = [
  {
    id: 'laundry-1',
    organizationId: ORGANIZATION_ID,
    kindId: 'laundry',
    name: {sv: 'Tvättstuga 1', en: 'Laundry room 1'},
    tags: {sv: ['torktumlare'], en: ['tumble dryer']},
    sortOrder: 1,
  },
  {
    id: 'laundry-2',
    organizationId: ORGANIZATION_ID,
    kindId: 'laundry',
    name: {sv: 'Tvättstuga 2', en: 'Laundry room 2'},
    tags: {},
    sortOrder: 2,
  },
  {
    id: 'drying-room',
    organizationId: ORGANIZATION_ID,
    kindId: 'drying',
    name: {sv: 'Torkrum', en: 'Drying room'},
    tags: {},
    sortOrder: 3,
  },
  {
    id: 'sauna',
    organizationId: ORGANIZATION_ID,
    kindId: 'sauna',
    name: {sv: 'Bastu', en: 'Sauna'},
    tags: {sv: ['max 4 personer'], en: ['max 4 people']},
    sortOrder: 4,
  },
  {
    id: 'workshop',
    organizationId: ORGANIZATION_ID,
    kindId: 'hobby',
    name: {sv: 'Snickerirum', en: 'Workshop'},
    tags: {},
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
// It keeps New York time, so its days and started slots differ from the
// first one's, and writes in English alone, so its apartments show
// English whatever their device speaks.
const OTHER_ORGANIZATION = {
  id: OTHER_ORGANIZATION_ID,
  name: 'Brf Andra',
  timeZone: 'America/New_York',
  bookingWindowDays: 14,
  locales: ['en'] satisfies Locale[],
  rulesText: {},
};

const OTHER_KINDS = [
  {
    organizationId: OTHER_ORGANIZATION_ID,
    id: 'laundry',
    name: {en: 'Laundry'},
    maxActive: 1,
  },
  {
    organizationId: OTHER_ORGANIZATION_ID,
    id: 'guest',
    name: {en: 'Guest apartment'},
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
    name: {en: 'Laundry room'},
    tags: {},
    sortOrder: 1,
  },
  {
    id: 'andra-guest',
    organizationId: OTHER_ORGANIZATION_ID,
    kindId: 'guest',
    name: {en: 'Guest apartment'},
    tags: {en: ['sleeps 4']},
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
  {days: 1, start: '10:00', label: CURRENT_APARTMENT, resourceId: 'workshop'},
  {days: 2, start: '15:00', label: CURRENT_APARTMENT, resourceId: 'workshop'},
];

const SEEDED_SUBSCRIPTIONS = [
  {days: 0, start: '16:00', label: CURRENT_APARTMENT, resourceId: 'laundry-2'},
  {days: 1, start: '07:00', label: '31', resourceId: 'laundry-1'},
  {days: 1, start: '13:00', label: CURRENT_APARTMENT, resourceId: 'laundry-1'},
  {days: 2, start: '19:00', label: '14', resourceId: 'laundry-2'},
];

// Only the first organization gets bookings and announcements.
function dateDaysFromToday(days: number): string {
  return addDays(isoDateIn(ORGANIZATION.timeZone), days);
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
      .delete(announcements)
      .where(inArray(announcements.organizationId, seeded));
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

  // The settings start over too, whatever the admin changed.
  for (const organization of [ORGANIZATION, OTHER_ORGANIZATION]) {
    await db
      .insert(organizations)
      .values(organization)
      .onConflictDoUpdate({target: organizations.id, set: organization});
  }
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
      endsAt: slotEndsAt(
        ORGANIZATION.timeZone,
        date,
        slot.end,
        slot.endOffsetDays,
      ),
    };
  }

  await db.insert(bookings).values(SEEDED_BOOKINGS.map(toRow));
  await db.insert(subscriptions).values(SEEDED_SUBSCRIPTIONS.map(toRow));

  await db.insert(announcements).values([
    {
      organizationId: ORGANIZATION_ID,
      title: {sv: 'Städdag lördag', en: 'Clean-up day Saturday'},
      body: {
        sv: 'Vi städar gården och förråden på lördag klockan 10. Föreningen bjuder på fika efteråt.',
        en: 'We clean the courtyard and storage rooms on Saturday at 10. Coffee and cake afterwards, on the association.',
      },
      publishedOn: dateDaysFromToday(0),
      // One week, counting today: what the admin's "1 vecka" sets.
      endsOn: dateDaysFromToday(6),
    },
    {
      organizationId: ORGANIZATION_ID,
      title: {sv: 'Ny torktumlare', en: 'New tumble dryer'},
      body: {
        sv: 'Torkrummet har fått en ny torktumlare. Rensa luddfiltret efter varje körning.',
        en: 'The drying room has a new tumble dryer. Clean the lint filter after every run.',
      },
      publishedOn: dateDaysFromToday(-3),
      endsOn: null,
    },
  ]);

  for (const label of APARTMENTS) {
    const resident = {
      name: RESIDENTS[label] ?? `Lägenhet ${label}`,
      organizationId: ORGANIZATION_ID,
      memberId: memberId(label),
    };

    if (label === BOARD_APARTMENT) {
      const board = await createUser({
        ...resident,
        email: BOARD_EMAIL,
        password: PASSWORD,
        admin: true,
      });
      await enrollTwoFactor(board.id, generateRandomString(32));
    } else {
      await createUser({...resident, email: `${label}@example.com`});
    }
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
      name: RESIDENTS[label] ?? `Lägenhet ${label}`,
      organizationId: OTHER_ORGANIZATION_ID,
      memberId: id,
    });
  }

  const admin = await createUser({
    email: 'admin@example.com',
    password: PASSWORD,
    name: `Admin ${ORGANIZATION.name}`,
    organizationId: ORGANIZATION_ID,
    admin: true,
  });
  await enrollTwoFactor(admin.id, generateRandomString(32));
  const otherAdmin = await createUser({
    email: 'admin@andra.example.com',
    password: PASSWORD,
    name: `Admin ${OTHER_ORGANIZATION.name}`,
    organizationId: OTHER_ORGANIZATION_ID,
    admin: true,
  });
  await enrollTwoFactor(otherAdmin.id, generateRandomString(32));

  console.log('Seed complete');
} finally {
  await pool.end();
}
