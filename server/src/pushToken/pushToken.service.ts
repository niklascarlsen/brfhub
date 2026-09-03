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
