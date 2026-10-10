import {sql} from 'drizzle-orm';

import type {FastifyBaseLogger} from 'fastify';

import {db} from '../db/index.js';
import {formatWhen, slotHasStarted} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {notifyMembers} from '../notification/notification.service.js';
import {listSubscribers} from '../subscription/subscription.service.js';

type ReleasedSlot = {
  date: string;
  resourceId: string;
  resourceName: string;
  start: string;
  end: string;
};

// The apartment that let the slot go, which is not told about it.
type ReleasedBy = Pick<Member, 'id' | 'timeZone'>;

export async function notifySlotReleased(
  slot: ReleasedSlot,
  releasedBy: ReleasedBy,
  log: FastifyBaseLogger,
): Promise<void> {
  const started = await db
    .execute<{
      started: boolean;
    }>(
      sql`select ${slotHasStarted(releasedBy.timeZone, slot.date, slot.start)} as started`,
    )
    .then((result) => result.rows[0]?.started);

  if (started) {
    return;
  }

  const subscribers = await listSubscribers(
    slot.resourceId,
    slot.date,
    slot.start,
  );

  await notifyMembers(
    subscribers
      .map((row) => row.memberId)
      .filter((memberId) => memberId !== releasedBy.id),
    {
      title: 'En tid blev ledig',
      body: `${slot.resourceName} ${formatWhen(slot.date, slot.start, slot.end)} är ledig – först till kvarn.`,
      data: {
        date: slot.date,
        start: slot.start,
        resourceId: slot.resourceId,
      },
    },
    log,
  );
}
