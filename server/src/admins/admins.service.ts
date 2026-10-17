import {and, asc, eq, sql, type SQL} from 'drizzle-orm';

import {
  createUser,
  removeCredentials,
  resetTwoFactor,
} from '../auth/auth.service.js';
import {endSessions} from '../auth/sessions.js';
import {violatedConstraint} from '../db/errors.js';
import {db, type Transaction} from '../db/index.js';
import {members, organizations, user} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import type {Admin} from '../lib/user.js';
import {sendAdminInvitation} from '../mail/mail.service.js';
import type {Notifier} from '../notification/notification.service.js';
import type {AddAdminBody, AdminUser} from './admins.dto.js';

function selectAdmins(admin: Admin, only?: SQL) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      apartment: members.label,
      twoFactorEnabled: user.twoFactorEnabled,
      // The day it was in the organization, which the admin reads it in.
      lastSignInOn: sql<
        string | null
      >`to_char(${user.lastSignInAt} at time zone ${organizations.timeZone}, 'YYYY-MM-DD')`,
      self: sql<boolean>`${user.id} = ${admin.userId}`,
    })
    .from(user)
    .innerJoin(organizations, eq(organizations.id, user.organizationId))
    .leftJoin(members, eq(members.id, user.memberId))
    .where(
      and(eq(user.organizationId, admin.organizationId), user.admin, only),
    );
}

export function listAdmins(admin: Admin): Promise<AdminUser[]> {
  return selectAdmins(admin).orderBy(asc(user.createdAt));
}

async function getAdminUser(admin: Admin, id: string): Promise<AdminUser> {
  const [found] = await selectAdmins(admin, eq(user.id, id));

  if (!found) {
    throw appError('NOT_FOUND', 'Unknown admin');
  }

  return found;
}

// A resident of the organization becomes an admin too, under the name the
// apartment knows them by; anyone else gets an account of their own.
// Either way they are mailed what to do next: set a password with a code,
// then an authenticator.
export async function addAdmin(
  admin: Admin,
  body: AddAdminBody,
  notifier: Notifier,
): Promise<AdminUser> {
  const id = await db
    .transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: user.id,
          organizationId: user.organizationId,
          admin: user.admin,
        })
        .from(user)
        .where(eq(user.email, body.email));

      if (existing) {
        if (
          existing.organizationId !== admin.organizationId ||
          existing.admin
        ) {
          throw appError('EMAIL_TAKEN');
        }

        // The apartment's sessions end: from now on the address signs in
        // with a password it chooses with a mailed code, so whoever else
        // shares the apartment's phones cannot pick it first.
        await tx
          .update(user)
          .set({admin: true})
          .where(eq(user.id, existing.id));
        await endSessions(existing.id, tx);

        return existing.id;
      }

      const created = await createUser(
        {
          email: body.email,
          name: body.name,
          organizationId: admin.organizationId,
          admin: true,
        },
        tx,
      );

      return created.id;
    })
    .catch((error: unknown) => {
      if (violatedConstraint(error) === 'user_email_unique') {
        throw appError('EMAIL_TAKEN');
      }

      throw error;
    });

  notifier.later(() => sendAdminInvitation(admin.organizationId, body.email));

  return getAdminUser(admin, id);
}

// Not the one asking: someone else removes you. Every admin of the
// organization is locked, so two admins removing each other at once
// cannot leave it without one: the second sees the first gone.
async function lockOther(
  tx: Transaction,
  admin: Admin,
  id: string,
): Promise<{memberId: string | null}> {
  if (id === admin.userId) {
    throw appError('OWN_ACCOUNT');
  }

  const admins = await tx
    .select({id: user.id, memberId: user.memberId})
    .from(user)
    .where(and(eq(user.organizationId, admin.organizationId), user.admin))
    .for('update');
  const other = admins.find((row) => row.id === id);

  if (!other) {
    throw appError('NOT_FOUND', 'Unknown admin');
  }

  if (admins.length < 2) {
    throw appError('LAST_ADMIN');
  }

  return other;
}

// A resident keeps the apartment and loses the admin's password and
// authenticator; anyone else loses the account. Every session ends.
export async function removeAdmin(
  admin: Admin,
  id: string,
): Promise<AdminUser> {
  const removed = await getAdminUser(admin, id);

  await db.transaction(async (tx) => {
    const other = await lockOther(tx, admin, id);

    if (other.memberId === null) {
      await tx.delete(user).where(eq(user.id, id));
      return;
    }

    await tx.update(user).set({admin: false}).where(eq(user.id, id));
    await removeCredentials(id, tx);
  });

  return removed;
}

// An admin who lost their authenticator sets a new one up at the next
// sign-in, once another admin has reset it.
export async function resetAdminTwoFactor(
  admin: Admin,
  id: string,
): Promise<AdminUser> {
  const reset = await getAdminUser(admin, id);

  await db.transaction(async (tx) => {
    await lockOther(tx, admin, id);
    await resetTwoFactor(id, tx);
  });

  return reset;
}
