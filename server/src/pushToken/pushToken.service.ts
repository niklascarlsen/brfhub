import {and, eq, inArray} from 'drizzle-orm';

import {db} from '../db/index.js';
import {pushTokens} from '../db/schema.js';
import type {Locale} from '../lib/locale.js';

// Sent again whenever the device starts or changes language, so the
// language stays the device's current one.
export async function savePushToken(
  memberId: string,
  token: string,
  locale: Locale,
): Promise<void> {
  await db
    .insert(pushTokens)
    .values({token, memberId, locale})
    .onConflictDoUpdate({target: pushTokens.token, set: {memberId, locale}});
}

export function listPushTokens(
  memberIds: string[],
): Promise<{memberId: string; token: string; locale: Locale}[]> {
  return db
    .select({
      memberId: pushTokens.memberId,
      token: pushTokens.token,
      locale: pushTokens.locale,
    })
    .from(pushTokens)
    .where(inArray(pushTokens.memberId, memberIds));
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
