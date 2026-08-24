import {db} from '../db/index.js';
import {pushTokens} from '../db/schema.js';

export async function savePushToken(
  userId: string,
  token: string,
): Promise<void> {
  await db
    .insert(pushTokens)
    .values({token, userId})
    .onConflictDoUpdate({target: pushTokens.token, set: {userId}});
}
