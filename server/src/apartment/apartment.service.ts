import {and, asc, eq, isNull, sql, type SQL} from 'drizzle-orm';
import type {FastifyBaseLogger} from 'fastify';

import {createUser, endSessions, setPassword} from '../auth/auth.service.js';
import {deleteBooking} from '../booking/booking.service.js';
import {stillActive} from '../booking/booking.query.js';
import {violatedConstraint} from '../db/errors.js';
import {db, type Executor} from '../db/index.js';
import {
  bookings,
  members,
  pushTokens,
  session,
  subscriptions,
  user,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {generatePassword} from '../lib/password.js';
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
  const lastSignIn = db
    .select({
      userId: session.userId,
      at: sql<Date>`max(${session.createdAt})`.as('at'),
    })
    .from(session)
    .groupBy(session.userId)
    .as('last_sign_in');

  const upcoming = db
    .select({
      memberId: bookings.memberId,
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(bookings)
    .where(and(isNull(bookings.releasedAt), sql`${bookings.endsAt} > now()`))
    .groupBy(bookings.memberId)
    .as('upcoming');

  return db
    .select({
      id: members.id,
      label: members.label,
      residentName: user.name,
      email: user.email,
      lastSignInAt: sql<
        string | null
      >`to_char(${lastSignIn.at} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      upcomingBookings: sql<number>`coalesce(${upcoming.count}, 0)`,
    })
    .from(members)
    .leftJoin(user, eq(user.memberId, members.id))
    .leftJoin(lastSignIn, eq(lastSignIn.userId, user.id))
    .leftJoin(upcoming, eq(upcoming.memberId, members.id))
    .where(
      and(
        eq(members.organizationId, organizationId),
        isNull(members.leftAt),
        only,
      ),
    );
}

// Numbers sort as numbers ("9" before "12"), anything else after them.
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

async function accountOf(memberId: string, executor: Executor = db) {
  const [row] = await executor
    .select({id: user.id, email: user.email})
    .from(user)
    .where(eq(user.memberId, memberId));

  return row;
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
  await getApartment(organizationId, id);

  await db
    .transaction(async (tx) => {
      if (body.label !== undefined) {
        await tx
          .update(members)
          .set({label: body.label})
          .where(eq(members.id, id));
      }

      const account = await accountOf(id, tx);

      if (!account) {
        if (body.residentName !== undefined || body.email !== undefined) {
          throw appError(
            'NOT_FOUND',
            'The apartment has no account, add a new resident',
          );
        }
        return;
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
          .where(eq(user.id, account.id));
      }

      // A new address is a new person signing in: whoever used the old
      // one is signed out.
      if (body.email !== undefined && body.email !== account.email) {
        await endSessions(account.id, tx);
      }
    })
    .catch(rethrowTaken);

  return getApartment(organizationId, id);
}

export async function resetPassword(
  organizationId: string,
  id: string,
): Promise<string> {
  await getApartment(organizationId, id);
  const account = await accountOf(id);

  if (!account) {
    throw appError('NOT_FOUND', 'The apartment has no account');
  }

  const password = generatePassword();

  await db.transaction(async (tx) => {
    await setPassword(account.id, password, tx);
    await endSessions(account.id, tx);
  });

  return password;
}

// The bookings go the way a member cancelling them would, so whoever
// queues for one of the times hears that it is free.
async function cancelUpcomingBookings(
  memberId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const upcoming = await db
    .select({id: bookings.id})
    .from(bookings)
    .where(stillActive(memberId));

  for (const booking of upcoming) {
    await deleteBooking(booking.id, memberId, log);
  }
}

// What a resident leaves behind when they move out: their account and
// sessions, their queue places and the devices that got their push.
async function clearResident(memberId: string, executor: Executor) {
  await executor.delete(user).where(eq(user.memberId, memberId));
  await executor
    .delete(subscriptions)
    .where(eq(subscriptions.memberId, memberId));
  await executor.delete(pushTokens).where(eq(pushTokens.memberId, memberId));
}

// Checked before anything is cancelled, so a taken address changes nothing.
async function assertEmailFree(email: string, memberId: string) {
  const [taken] = await db
    .select({memberId: user.memberId})
    .from(user)
    .where(eq(user.email, email));

  if (taken && taken.memberId !== memberId) {
    throw appError('EMAIL_TAKEN');
  }
}

export async function replaceResident(
  organizationId: string,
  id: string,
  body: NewResidentBody,
  log: FastifyBaseLogger,
): Promise<{apartment: Apartment; password: string}> {
  await getApartment(organizationId, id);
  await assertEmailFree(body.email, id);
  await cancelUpcomingBookings(id, log);

  const password = generatePassword();

  await db
    .transaction(async (tx) => {
      await clearResident(id, tx);
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
    })
    .catch(rethrowTaken);

  return {apartment: await getApartment(organizationId, id), password};
}

export async function removeApartment(
  organizationId: string,
  id: string,
  log: FastifyBaseLogger,
): Promise<void> {
  await getApartment(organizationId, id);
  await cancelUpcomingBookings(id, log);

  await db.transaction(async (tx) => {
    await clearResident(id, tx);
    await tx
      .update(members)
      .set({leftAt: sql`now()`})
      .where(eq(members.id, id));
  });
}
