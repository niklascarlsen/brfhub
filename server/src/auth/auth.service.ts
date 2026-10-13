import {randomUUID} from 'node:crypto';

import {createOTP} from '@better-auth/utils/otp';
import {
  generateRandomString,
  symmetricDecrypt,
  symmetricEncrypt,
} from 'better-auth/crypto';
import {and, eq, like} from 'drizzle-orm';

import {db, type Executor} from '../db/index.js';
import {account, session, twoFactor, user, verification} from '../db/schema.js';
import {auth} from './auth.js';

// An apartment's account signs in with a code from its mail and has no
// password. An admin's has one once it is set: by the seed and the tests
// here, by the admin themselves with a mailed code, which makes the
// credential account when there is none.
type NewUser = {
  email: string;
  name: string;
  organizationId: string;
  memberId?: string;
} & ({admin: true; password?: string} | {admin?: false});

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

  if (newUser.admin && newUser.password !== undefined) {
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

// Makes the credential account when the admin has none yet, as the mailed
// code does.
export async function setPassword(
  userId: string,
  password: string,
  executor: Executor = db,
): Promise<void> {
  const hash = await hashPassword(password);
  const updated = await executor
    .update(account)
    .set({password: hash})
    .where(
      and(eq(account.userId, userId), eq(account.providerId, 'credential')),
    )
    .returning({id: account.id});

  if (updated.length === 0) {
    await executor.insert(account).values({
      id: randomUUID(),
      userId,
      providerId: 'credential',
      accountId: userId,
      password: hash,
    });
  }
}

// Every device signed in as this user has to sign in again.
export async function endSessions(
  userId: string,
  executor: Executor = db,
): Promise<void> {
  await executor.delete(session).where(eq(session.userId, userId));
}

// The admin's password and authenticator go, with every session: the
// account is an apartment's alone from now on, or about to be removed.
export async function removeCredentials(
  userId: string,
  executor: Executor = db,
): Promise<void> {
  await executor.delete(account).where(eq(account.userId, userId));
  await resetTwoFactor(userId, executor);
}

// The authenticator is forgotten and every session ended: the admin sets
// a new one up at the next sign-in. The devices trusted to skip the code
// are forgotten too, since a lost one is why this is done.
export async function resetTwoFactor(
  userId: string,
  executor: Executor = db,
): Promise<void> {
  await executor.delete(twoFactor).where(eq(twoFactor.userId, userId));
  await executor
    .delete(verification)
    .where(
      and(
        like(verification.identifier, 'trust-device-%'),
        eq(verification.value, userId),
      ),
    );
  await executor
    .update(user)
    .set({twoFactorEnabled: false})
    .where(eq(user.id, userId));
  await endSessions(userId, executor);
}

// The two-factor plugin's own layout: the secret and the backup codes
// encrypted with the auth secret, which the plugin decrypts when it
// verifies a code. Written here for the seed and the tests, which cannot
// scan a QR code.
export async function enrollTwoFactor(
  userId: string,
  secret: string,
  executor: Executor = db,
): Promise<void> {
  const {secretConfig} = await auth.$context;
  const backupCodes = Array.from({length: 10}, () =>
    generateRandomString(10, 'a-z', '0-9'),
  );

  await executor.delete(twoFactor).where(eq(twoFactor.userId, userId));
  await executor.insert(twoFactor).values({
    id: randomUUID(),
    userId,
    secret: await symmetricEncrypt({key: secretConfig, data: secret}),
    backupCodes: await symmetricEncrypt({
      key: secretConfig,
      data: JSON.stringify(backupCodes),
    }),
    verified: true,
  });
  await executor
    .update(user)
    .set({twoFactorEnabled: true})
    .where(eq(user.id, userId));
}

// The secret the user's authenticator holds, for a script that stands in
// for one. Null when none is set up.
export async function twoFactorSecret(userId: string): Promise<string | null> {
  const [row] = await db
    .select({secret: twoFactor.secret})
    .from(twoFactor)
    .where(eq(twoFactor.userId, userId));

  if (!row) {
    return null;
  }

  const {secretConfig} = await auth.$context;

  return symmetricDecrypt({key: secretConfig, data: row.secret});
}

// What an authenticator app shows right now for the secret.
export function totpCode(secret: string): Promise<string> {
  return createOTP(secret).totp();
}
