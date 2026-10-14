import {and, eq, like} from 'drizzle-orm';

import {db, type Executor} from '../db/index.js';
import {session, verification} from '../db/schema.js';

// An apartment signs in with a code from its mail and stays signed in for
// as long as it keeps using the app. An admin's session is cut short, since
// it opens every apartment: a week after sign-in however much it is used,
// as Better Auth keeps extending a used one. That is apart from the
// trusted device: an admin who ticks it signs in again on that device with
// the password alone for Better Auth's 30 days, counted from the last such
// sign-in, until they sign out, set a new password or a colleague resets
// their two-step.
export const MEMBER_SESSION_DAYS = 180;
export const ADMIN_SESSION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

// Whether an admin's session has had its week. Only this session: the
// admin's other devices signed in on their own days.
export function adminSessionExpired(createdAt: Date): boolean {
  return createdAt.getTime() + ADMIN_SESSION_DAYS * DAY_MS < Date.now();
}

// Every device signed in as this user has to sign in again.
export async function endSessions(
  userId: string,
  executor: Executor = db,
): Promise<void> {
  await executor.delete(session).where(eq(session.userId, userId));
}

// The devices trusted to skip the authenticator's code for a month are
// forgotten: each gives the code again at its next sign-in.
export async function forgetTrustedDevices(
  userId: string,
  executor: Executor = db,
): Promise<void> {
  await executor
    .delete(verification)
    .where(
      and(
        like(verification.identifier, 'trust-device-%'),
        eq(verification.value, userId),
      ),
    );
}
