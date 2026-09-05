import {inArray} from 'drizzle-orm';

import {db} from '../db/index.js';
import {pushTokens} from '../db/schema.js';

export async function savePushToken(
  memberId: string,
  token: string,
): Promise<void> {
  await db
    .insert(pushTokens)
    .values({token, memberId})
    .onConflictDoUpdate({target: pushTokens.token, set: {memberId}});
}

export async function listPushTokens(memberIds: string[]): Promise<string[]> {
  const rows = await db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .where(inArray(pushTokens.memberId, memberIds));
  return rows.map((row) => row.token);
}

export async function removePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  await db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
}
