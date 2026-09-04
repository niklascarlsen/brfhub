import {inArray, sql} from 'drizzle-orm';

import type {FastifyBaseLogger} from 'fastify';

import {db} from '../db/index.js';
import {pushTokens} from '../db/schema.js';
import {sendPush} from '../lib/push.js';
import {formatWhen, slotHasStarted} from '../lib/time.js';
import {listSubscribers} from '../subscription/subscription.service.js';

type ReleasedSlot = {
  date: string;
  resourceId: string;
  resourceName: string;
  start: string;
  end: string;
};

export async function notifySlotReleased(
  slot: ReleasedSlot,
  releasedBy: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const started = await db
    .execute<{
      started: boolean;
    }>(sql`select ${slotHasStarted(slot.date, slot.start)} as started`)
    .then((result) => result.rows[0]?.started);

  if (started) {
    return;
  }

  const subscribers = await listSubscribers(
    slot.resourceId,
    slot.date,
    slot.start,
  );
  const memberIds = subscribers
    .map((row) => row.memberId)
    .filter((memberId) => memberId !== releasedBy);

  if (memberIds.length === 0) {
    return;
  }

  const tokens = await db
    .select({token: pushTokens.token})
    .from(pushTokens)
    .where(inArray(pushTokens.memberId, memberIds));

  try {
    const failures = await sendPush(
      tokens.map(({token}) => ({
        to: token,
        title: 'En tid blev ledig',
        body: `${slot.resourceName} ${formatWhen(slot.date, slot.start, slot.end)} är ledig – först till kvarn.`,
        data: {
          date: slot.date,
          start: slot.start,
          resourceId: slot.resourceId,
        },
      })),
    );

    const unregistered = failures
      .filter((failure) => failure.unregistered)
      .map((failure) => failure.token);

    if (unregistered.length > 0) {
      await db
        .delete(pushTokens)
        .where(inArray(pushTokens.token, unregistered));
    }

    for (const failure of failures.filter((item) => !item.unregistered)) {
      log.error({failure, slot}, 'push notification rejected');
    }
  } catch (error) {
    log.error({err: error, slot}, 'push notification failed');
  }
}
