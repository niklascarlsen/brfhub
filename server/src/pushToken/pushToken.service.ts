import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lt,
  not,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';

import {db} from '../db/index.js';
import {ADMIN_SESSION_DAYS} from '../auth/sessions.js';
import {pushTokens, session, user} from '../db/schema.js';
import type {Locale} from '../lib/locale.js';

// The devices an apartment can have push on at once. Beyond it the ones
// not heard from for the longest go, so a phone that is wiped and signed
// in on again does not pile up.
export const PUSH_TOKENS_PER_APARTMENT = 20;

// Sent again whenever the device starts or changes language, so the
// language stays the device's current one. A device another account signed
// in on moves to this one: holding the token is holding the device, as
// the push services themselves see it.
export async function savePushToken(
  memberId: string,
  sessionId: string,
  token: string,
  locale: Locale,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(pushTokens)
      .values({token, memberId, sessionId, locale})
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: {memberId, sessionId, locale, createdAt: sql`now()`},
      });

    const kept = tx
      .select({token: pushTokens.token})
      .from(pushTokens)
      .where(eq(pushTokens.memberId, memberId))
      .orderBy(desc(pushTokens.createdAt), desc(pushTokens.token))
      .limit(PUSH_TOKENS_PER_APARTMENT);

    await tx
      .delete(pushTokens)
      .where(
        and(
          eq(pushTokens.memberId, memberId),
          notInArray(pushTokens.token, kept),
        ),
      );
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

// With registeredBefore, only those not registered again since.
export async function removePushTokens(
  tokens: string[],
  registeredBefore?: Date,
): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  await db
    .delete(pushTokens)
    .where(
      and(
        inArray(pushTokens.token, tokens),
        registeredBefore && lt(pushTokens.createdAt, registeredBefore),
      ),
    );
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
