import {and, asc, eq, isNull, sql, type SQL} from 'drizzle-orm';

import {createUser} from '../auth/auth.service.js';
import {endSessions} from '../auth/sessions.js';
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
import {notExpired} from '../lib/time.js';
import type {Organization} from '../lib/user.js';
import {sendApartmentLinked, sendWelcome} from '../mail/mail.service.js';
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
): Promise<{userId: string; email: string; admin: boolean; label: string}> {
  await lockApartmentBookings(tx, id);

  const [apartment] = await tx
    .select({id: members.id, label: members.label})
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
    .select({userId: user.id, email: user.email, admin: user.admin})
    .from(user)
    .where(eq(user.memberId, id));

  if (!account) {
    throw new Error(`Apartment ${id} has no account`);
  }

  return {...account, label: apartment.label};
}

// An admin of the organization who has no apartment is given one on their
// own account, so one address stays one person. Null for any other
// address: a new one gets an account, a taken one is refused. The row is
// held, so two apartments given to the same admin at once do not both
// see it free: the second finds it taken and is refused.
async function adminWithoutApartment(
  tx: Transaction,
  organizationId: string,
  email: string,
): Promise<{id: string} | null> {
  const [found] = await tx
    .select({
      id: user.id,
      organizationId: user.organizationId,
      admin: user.admin,
      memberId: user.memberId,
    })
    .from(user)
    .where(eq(user.email, email))
    .for('update');

  return found &&
    found.organizationId === organizationId &&
    found.admin &&
    found.memberId === null
    ? {id: found.id}
    : null;
}

// Who signs in for the apartment from now on. Answers whether that is an
// admin, who is mailed differently.
async function assignResident(
  tx: Transaction,
  organizationId: string,
  memberId: string,
  resident: {email: string; name: string},
): Promise<{admin: boolean}> {
  const admin = await adminWithoutApartment(tx, organizationId, resident.email);

  if (admin !== null) {
    await tx
      .update(user)
      .set({memberId, name: resident.name})
      .where(eq(user.id, admin.id));
    return {admin: true};
  }

  await createUser(
    {
      email: resident.email,
      name: resident.name,
      organizationId,
      memberId,
    },
    tx,
  );
  return {admin: false};
}

// The account leaves the apartment: an admin's stays, as admin alone, any
// other goes.
async function detachAccount(
  tx: Transaction,
  account: {userId: string; admin: boolean},
) {
  if (account.admin) {
    await tx
      .update(user)
      .set({memberId: null})
      .where(eq(user.id, account.userId));
  } else {
    await tx.delete(user).where(eq(user.id, account.userId));
  }
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

// The resident is told by mail that they can sign in, once the apartment
// is there to sign in to. An admin already can, and is told where the
// apartment is instead.
function welcome(
  notifier: Notifier,
  organizationId: string,
  resident: {email: string; admin: boolean; label: string},
) {
  notifier.later(() =>
    resident.admin
      ? sendApartmentLinked(organizationId, resident.email, resident.label)
      : sendWelcome(organizationId, resident.email),
  );
}

export async function createApartment(
  organizationId: string,
  body: CreateApartmentBody,
  notifier: Notifier,
): Promise<Apartment> {
  const {memberId, admin} = await db
    .transaction(async (tx) => {
      const [member] = await tx
        .insert(members)
        .values({organizationId, label: body.label})
        .returning({id: members.id});

      if (!member) {
        throw new Error('Insert returned no member');
      }

      const resident = await assignResident(tx, organizationId, member.id, {
        email: body.email,
        name: body.residentName,
      });

      return {memberId: member.id, admin: resident.admin};
    })
    .catch(rethrowTaken);

  welcome(notifier, organizationId, {
    email: body.email,
    admin,
    label: body.label,
  });

  return getApartment(organizationId, memberId);
}

export async function updateApartment(
  organizationId: string,
  id: string,
  body: UpdateApartmentBody,
  notifier: Notifier,
): Promise<Apartment> {
  const changed = await db
    .transaction(async (tx) => {
      const account = await lockApartment(tx, organizationId, id);
      const label = body.label ?? account.label;

      if (body.label !== undefined) {
        await tx
          .update(members)
          .set({label: body.label})
          .where(eq(members.id, id));
      }

      const name =
        body.residentName === undefined ? {} : {name: body.residentName};

      if (body.email === undefined || body.email === account.email) {
        await tx.update(user).set(name).where(eq(user.id, account.userId));
        return null;
      }

      // A new address is a new person signing in: whoever used the old
      // one is signed out. The bookings stay with the apartment.
      await signOutEverywhere(tx, account, id);
      const admin = await adminWithoutApartment(tx, organizationId, body.email);

      if (admin !== null) {
        await detachAccount(tx, account);
        await tx
          .update(user)
          .set({memberId: id, ...name})
          .where(eq(user.id, admin.id));
      } else {
        await tx
          .update(user)
          .set({email: body.email, ...name})
          .where(eq(user.id, account.userId));
      }

      return {email: body.email, admin: admin !== null, label};
    })
    .catch(rethrowTaken);

  if (changed !== null) {
    welcome(notifier, organizationId, changed);
  }

  return getApartment(organizationId, id);
}

// Answers with the apartment's number, for the event log.
export async function signOutApartment(
  organizationId: string,
  id: string,
): Promise<string> {
  return db.transaction(async (tx) => {
    const account = await lockApartment(tx, organizationId, id);
    await signOutEverywhere(tx, account, id);
    return account.label;
  });
}

// What a resident leaves behind when they move out: their account and with
// it their sessions, their queue places and the devices that got their push.
// An admin keeps the account, signed out everywhere, and only loses the
// apartment.
async function clearResident(tx: Transaction, memberId: string) {
  const [account] = await tx
    .select({userId: user.id, admin: user.admin})
    .from(user)
    .where(eq(user.memberId, memberId));

  if (account) {
    await endSessions(account.userId, tx);
    await detachAccount(tx, account);
  }

  await tx.delete(subscriptions).where(eq(subscriptions.memberId, memberId));
  await tx.delete(pushTokens).where(eq(pushTokens.memberId, memberId));
}

export async function replaceResident(
  {organizationId, timeZone, locales}: Organization,
  id: string,
  body: NewResidentBody,
  notifier: Notifier,
): Promise<Apartment> {
  const {freed, admin, label} = await db
    .transaction(async (tx) => {
      const account = await lockApartment(tx, organizationId, id);
      const released = await releaseAll(tx, {id, timeZone, locales});
      await clearResident(tx, id);
      const resident = await assignResident(tx, organizationId, id, {
        email: body.email,
        name: body.residentName,
      });

      return {freed: released, admin: resident.admin, label: account.label};
    })
    .catch(rethrowTaken);

  announceReleased(notifier, freed);
  welcome(notifier, organizationId, {email: body.email, admin, label});

  return getApartment(organizationId, id);
}

export async function removeApartment(
  {organizationId, timeZone, locales}: Organization,
  id: string,
  notifier: Notifier,
): Promise<string> {
  const {freed, label} = await db.transaction(async (tx) => {
    const account = await lockApartment(tx, organizationId, id);
    const released = await releaseAll(tx, {id, timeZone, locales});
    await clearResident(tx, id);
    await tx
      .update(members)
      .set({leftAt: sql`now()`})
      .where(eq(members.id, id));

    return {freed: released, label: account.label};
  });

  announceReleased(notifier, freed);

  return label;
}
