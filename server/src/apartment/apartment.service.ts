import {and, asc, eq, isNull, sql, type SQL} from 'drizzle-orm';

import {createUser, endSessions, setPassword} from '../auth/auth.service.js';
import {announceReleased} from '../booking/booking.notification.js';
import {lockApartmentBookings, releaseAll} from '../booking/lifecycle.js';
import {violatedConstraint} from '../db/errors.js';
import {db, type Transaction} from '../db/index.js';
import {
  bookings,
  members,
  organizations,
  pushTokens,
  subscriptions,
  user,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {generatePassword} from '../lib/password.js';
import {notExpired} from '../lib/time.js';
import type {Organization} from '../lib/user.js';
import type {Notifier} from '../notification/notification.service.js';
import type {
  Apartment,
  CreateApartmentBody,
  NewResidentBody,
  UpdateApartmentBody,
} from './apartment.dto.js';

// Unique violations name the value that was taken.
function rethrowTaken(error: unknown): never {
  switch (violatedConstraint(error)) {
    case 'members_organization_label_unique':
      throw appError('APARTMENT_TAKEN');
    case 'user_email_unique':
      throw appError('EMAIL_TAKEN');
    default:
      throw error;
  }
}

function selectApartments(organizationId: string, only?: SQL) {
  const upcoming = db
    .select({
      memberId: bookings.memberId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.organizationId, organizationId),
        isNull(bookings.releasedAt),
        notExpired(bookings.endsAt),
      ),
    )
    .groupBy(bookings.memberId)
    .as('upcoming');

  return db
    .select({
      id: members.id,
      label: members.label,
      residentName: user.name,
      email: user.email,
      // The day it was in the organization, which the admin reads it in.
      lastSignInOn: sql<
        string | null
      >`to_char(${user.lastSignInAt} at time zone ${organizations.timeZone}, 'YYYY-MM-DD')`,
      upcomingBookings: sql<number>`coalesce(${upcoming.count}, 0)`,
    })
    .from(members)
    .innerJoin(organizations, eq(organizations.id, members.organizationId))
    .innerJoin(user, eq(user.memberId, members.id))
    .leftJoin(upcoming, eq(upcoming.memberId, members.id))
    .where(
      and(
        eq(members.organizationId, organizationId),
        isNull(members.leftAt),
        only,
      ),
    );
}

// Shorter labels first, so plain numbers sort as numbers ("9" before "12").
const byLabel = [
  asc(sql`length(${members.label})`),
  asc(members.label),
] as const;

export function listApartments(organizationId: string): Promise<Apartment[]> {
  return selectApartments(organizationId).orderBy(...byLabel);
}

async function getApartment(
  organizationId: string,
  id: string,
): Promise<Apartment> {
  const [apartment] = await selectApartments(
    organizationId,
    eq(members.id, id),
  );

  if (!apartment) {
    throw appError('NOT_FOUND', 'Unknown apartment');
  }

  return apartment;
}

// Every change to an apartment starts here: the row and its bookings are
// held until the transaction ends, so two admins acting at once, or the
// resident booking meanwhile, wait their turn instead of interleaving.
// The bookings come first, as booking takes them before its insert locks
// the row: the other order deadlocks with a booking under way.
async function lockApartment(
  tx: Transaction,
  organizationId: string,
  id: string,
): Promise<{userId: string; email: string}> {
  await lockApartmentBookings(tx, id);

  const [apartment] = await tx
    .select({id: members.id})
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.id, id),
        isNull(members.leftAt),
      ),
    )
    .for('update');

  if (!apartment) {
    throw appError('NOT_FOUND', 'Unknown apartment');
  }

  const [account] = await tx
    .select({userId: user.id, email: user.email})
    .from(user)
    .where(eq(user.memberId, id));

  if (!account) {
    throw new Error(`Apartment ${id} has no account`);
  }

  return account;
}

// A device that got the apartment's push keeps getting it until its token
// goes, even signed out.
async function signOutEverywhere(
  tx: Transaction,
  account: {userId: string},
  memberId: string,
) {
  await endSessions(account.userId, tx);
  await tx.delete(pushTokens).where(eq(pushTokens.memberId, memberId));
}

export async function createApartment(
  organizationId: string,
  body: CreateApartmentBody,
): Promise<{apartment: Apartment; password: string}> {
  const password = generatePassword();

  const memberId = await db
    .transaction(async (tx) => {
      const [member] = await tx
        .insert(members)
        .values({organizationId, label: body.label})
        .returning({id: members.id});

      if (!member) {
        throw new Error('Insert returned no member');
      }

      await createUser(
        {
          email: body.email,
          password,
          name: body.residentName,
          organizationId,
          role: 'member',
          memberId: member.id,
        },
        tx,
      );

      return member.id;
    })
    .catch(rethrowTaken);

  return {apartment: await getApartment(organizationId, memberId), password};
}

export async function updateApartment(
  organizationId: string,
  id: string,
  body: UpdateApartmentBody,
): Promise<Apartment> {
  await db
    .transaction(async (tx) => {
      const account = await lockApartment(tx, organizationId, id);

      if (body.label !== undefined) {
        await tx
          .update(members)
          .set({label: body.label})
          .where(eq(members.id, id));
      }

      if (body.residentName !== undefined || body.email !== undefined) {
        await tx
          .update(user)
          .set({
            ...(body.residentName === undefined
              ? {}
              : {name: body.residentName}),
            ...(body.email === undefined ? {} : {email: body.email}),
          })
          .where(eq(user.id, account.userId));
      }

      // A new address is a new person signing in: whoever used the old
      // one is signed out.
      if (body.email !== undefined && body.email !== account.email) {
        await signOutEverywhere(tx, account, id);
      }
    })
    .catch(rethrowTaken);

  return getApartment(organizationId, id);
}

export async function resetPassword(
  organizationId: string,
  id: string,
): Promise<string> {
  const password = generatePassword();

  await db.transaction(async (tx) => {
    const account = await lockApartment(tx, organizationId, id);
    await setPassword(account.userId, password, tx);
    await signOutEverywhere(tx, account, id);
  });

  return password;
}

// What a resident leaves behind when they move out: their account and with
// it their sessions, their queue places and the devices that got their push.
async function clearResident(tx: Transaction, memberId: string) {
  await tx.delete(user).where(eq(user.memberId, memberId));
  await tx.delete(subscriptions).where(eq(subscriptions.memberId, memberId));
  await tx.delete(pushTokens).where(eq(pushTokens.memberId, memberId));
}

export async function replaceResident(
  {organizationId, timeZone, locales}: Organization,
  id: string,
  body: NewResidentBody,
  notifier: Notifier,
): Promise<{apartment: Apartment; password: string}> {
  const password = generatePassword();

  const freed = await db
    .transaction(async (tx) => {
      await lockApartment(tx, organizationId, id);
      const released = await releaseAll(tx, {id, timeZone, locales});
      await clearResident(tx, id);
      await createUser(
        {
          email: body.email,
          password,
          name: body.residentName,
          organizationId,
          role: 'member',
          memberId: id,
        },
        tx,
      );

      return released;
    })
    .catch(rethrowTaken);

  announceReleased(notifier, freed);

  return {apartment: await getApartment(organizationId, id), password};
}

export async function removeApartment(
  {organizationId, timeZone, locales}: Organization,
  id: string,
  notifier: Notifier,
): Promise<void> {
  const freed = await db.transaction(async (tx) => {
    await lockApartment(tx, organizationId, id);
    const released = await releaseAll(tx, {id, timeZone, locales});
    await clearResident(tx, id);
    await tx
      .update(members)
      .set({leftAt: sql`now()`})
      .where(eq(members.id, id));

    return released;
  });

  announceReleased(notifier, freed);
}
