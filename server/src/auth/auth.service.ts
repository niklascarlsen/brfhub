import {randomUUID} from 'node:crypto';

import {and, eq} from 'drizzle-orm';

import {db, type Executor} from '../db/index.js';
import {account, session, user} from '../db/schema.js';
import {auth} from './auth.js';

// An apartment's account signs in with a code from its mail and has no
// password. An admin's has one, and so a credential account.
type NewUser = {
  email: string;
  name: string;
  organizationId: string;
  memberId?: string;
} & ({admin: true; password: string} | {admin?: false});

async function hashPassword(password: string): Promise<string> {
  const {password: passwords} = await auth.$context;
  return passwords.hash(password);
}

// Sign-up over HTTP is disabled, so accounts are written here the way the
// sign-up route would. Plain inserts rather than Better Auth's adapter, so
// the rows can join the caller's transaction. The address comes from an
// admin, so it counts as verified: an unverified account has its password
// and sessions revoked the first time a code signs it in.
export async function createUser(newUser: NewUser, executor: Executor = db) {
  const {email, name, organizationId, memberId} = newUser;
  const id = randomUUID();

  const [created] = await executor
    .insert(user)
    .values({
      id,
      email: email.toLowerCase(),
      emailVerified: true,
      name,
      organizationId,
      memberId: memberId ?? null,
      admin: newUser.admin === true,
    })
    .returning();

  if (!created) {
    throw new Error('Insert returned no user');
  }

  if (newUser.admin) {
    await executor.insert(account).values({
      id: randomUUID(),
      userId: id,
      providerId: 'credential',
      accountId: id,
      password: await hashPassword(newUser.password),
    });
  }

  return created;
}

export async function setPassword(
  userId: string,
  password: string,
  executor: Executor = db,
): Promise<void> {
  await executor
    .update(account)
    .set({password: await hashPassword(password)})
    .where(
      and(eq(account.userId, userId), eq(account.providerId, 'credential')),
    );
}

// Every device signed in as this user has to sign in again.
export async function endSessions(
  userId: string,
  executor: Executor = db,
): Promise<void> {
  await executor.delete(session).where(eq(session.userId, userId));
}
