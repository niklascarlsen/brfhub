import {inArray} from 'drizzle-orm';

import type {FastifyBaseLogger} from 'fastify';

import {db} from '../db/index.js';
import {pushTokens} from '../db/schema.js';
import {sendPush} from '../lib/push.js';
import {formatWhen} from '../lib/time.js';
import {subscribersOf} from './subscriptions.js';

type ReleasedSlot = {
  date: string;
  slotId: string;
  start: string;
  end: string;
};

export async function notifySlotReleased(
  slot: ReleasedSlot,
  releasedBy: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const subscribers = await subscribersOf(slot.date, slot.slotId);
  const userIds = subscribers
    .map((row) => row.userId)
    .filter((userId) => userId !== releasedBy);

  if (userIds.length === 0) {
    return;
  }

  const tokens = await db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .where(inArray(pushTokens.userId, userIds));

  try {
    await sendPush(
      tokens.map(({token}) => ({
        to: token,
        title: 'En tid blev ledig',
        body: `${formatWhen(slot.date, slot.start, slot.end)} är ledig – först till kvarn.`,
        data: {date: slot.date, slotId: slot.slotId},
      })),
    );
  } catch (error) {
    log.error({err: error, slot}, 'push notification failed');
  }
}
