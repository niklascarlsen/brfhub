import {and, eq, like} from 'drizzle-orm';

import {db, type Executor} from '../db/index.js';
import {session, verification} from '../db/schema.js';

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
