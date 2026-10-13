import {and, asc, eq, isNull, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {queue} from '../booking/lifecycle.js';
import {bookings, resources, subscriptions} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {asIsoText, notExpired, slotHasStarted} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {resourceRefFields} from '../resource/resource.service.js';
import type {Subscription} from './subscription.dto.js';

function stillActive(memberId: string) {
  return and(
    eq(subscriptions.memberId, memberId),
    notExpired(subscriptions.endsAt),
  );
}

export function listSubscriptions(member: Member): Promise<Subscription[]> {
  return db
    .select({
      id: subscriptions.id,
      date: subscriptions.date,
      start: subscriptions.start,
      end: subscriptions.end,
      endsAt: asIsoText(subscriptions.endsAt),
      available: sql<boolean>`${bookings.id} is null`,
      started: slotHasStarted(
        member.timeZone,
        subscriptions.date,
        subscriptions.start,
      ),
      ...resourceRefFields(member.locale),
    })
    .from(subscriptions)
    .innerJoin(resources, eq(subscriptions.resourceId, resources.id))
    .leftJoin(
      bookings,
      and(
        eq(bookings.start, subscriptions.start),
        eq(bookings.resourceId, subscriptions.resourceId),
        eq(bookings.date, subscriptions.date),
        isNull(bookings.releasedAt),
      ),
    )
    .where(stillActive(member.id))
    .orderBy(
      asc(subscriptions.date),
      asc(subscriptions.start),
      asc(resources.sortOrder),
    );
}

export function createSubscription(
  subscription: Parameters<typeof queue>[0],
): Promise<Subscription> {
  return queue(subscription);
}

export async function deleteSubscription(
  id: string,
  memberId: string,
): Promise<void> {
  const existing = await db
    .select({memberId: subscriptions.memberId})
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .then((rows) => rows[0]);

  // Already gone is done, as for a cancelled booking.
  if (!existing) {
    return;
  }

  if (existing.memberId !== memberId) {
    throw appError('FORBIDDEN', 'Not your subscription');
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}
