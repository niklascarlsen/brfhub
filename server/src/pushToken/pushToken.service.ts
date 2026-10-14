import {and, eq, gt, inArray, not, or, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {ADMIN_SESSION_DAYS} from '../auth/auth.js';
import {pushTokens, session, user} from '../db/schema.js';
import type {Locale} from '../lib/locale.js';

// Sent again whenever the device starts or changes language, so the
// language stays the device's current one. A device another account signed
// in on moves to this one.
export async function savePushToken(
  memberId: string,
  sessionId: string,
  token: string,
  locale: Locale,
): Promise<void> {
  await db
    .insert(pushTokens)
    .values({token, memberId, sessionId, locale})
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: {memberId, sessionId, locale},
    });
}

export function listPushTokens(
  memberIds: string[],
): Promise<{memberId: string; token: string; locale: Locale}[]> {
  // A session that ran out stays until it is used again, and so does an
  // admin's past the week getSignedIn allows it; either device is signed
  // out already.
  return db
    .select({
      memberId: pushTokens.memberId,
      token: pushTokens.token,
      locale: pushTokens.locale,
    })
    .from(pushTokens)
    .innerJoin(session, eq(session.id, pushTokens.sessionId))
    .innerJoin(user, eq(user.id, session.userId))
    .where(
      and(
        inArray(pushTokens.memberId, memberIds),
        gt(session.expiresAt, sql`now()`),
        or(
          not(user.admin),
          gt(
            session.createdAt,
            sql`now() - make_interval(days => ${ADMIN_SESSION_DAYS})`,
          ),
        ),
      ),
    );
}

export async function removePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
}

// Only the apartment a token is bound to may drop it.
export async function removeMemberPushToken(
  memberId: string,
  token: string,
): Promise<void> {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.token, token), eq(pushTokens.memberId, memberId)));
}
