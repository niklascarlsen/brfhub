import {and, eq} from 'drizzle-orm';

import {db, type Executor} from '../db/index.js';
import {subscriptions} from '../db/schema.js';
import {notExpired} from '../lib/time.js';

// The apartments queueing for a slot. Read in the transaction that frees
// the slot, so the queue is the one that transaction sees.
export function listSubscribers(
  resourceId: string,
  date: string,
  start: string,
  executor: Executor = db,
) {
  return executor
    .select({memberId: subscriptions.memberId})
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.resourceId, resourceId),
        eq(subscriptions.date, date),
        eq(subscriptions.start, start),
        notExpired(subscriptions.endsAt),
      ),
    );
}
