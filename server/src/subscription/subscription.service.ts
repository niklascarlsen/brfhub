import {and, asc, eq, isNull, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {
  bookings,
  resourceSlots,
  resources,
  subscriptions,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  asIsoText,
  notExpired,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {getResource} from '../resource/resource.service.js';
import {resourceOpenOn, slotInEffect} from '../resource/schedule.query.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Subscription} from './subscription.dto.js';

const resourceFields = {
  resourceId: resources.id,
  resourceName: resources.name,
  resourceKind: resources.kindId,
};

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
      ...resourceFields,
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

export async function createSubscription({
  member,
  date,
  start,
  resourceId,
}: {
  member: Member;
  date: string;
  start: string;
  resourceId: string;
}): Promise<Subscription> {
  const resource = await getResource(member.organizationId, resourceId);
  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  const slot = await db
    .select({
      start: resourceSlots.start,
      end: resourceSlots.end,
      endOffsetDays: resourceSlots.endOffsetDays,
      ended: slotHasEnded(
        member.timeZone,
        date,
        resourceSlots.end,
        resourceSlots.endOffsetDays,
      ),
      started: slotHasStarted(member.timeZone, date, resourceSlots.start),
      bookedBy: bookings.memberId,
    })
    .from(resourceSlots)
    .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
    .leftJoin(
      bookings,
      and(
        eq(bookings.start, resourceSlots.start),
        eq(bookings.resourceId, resourceId),
        eq(bookings.date, date),
        isNull(bookings.releasedAt),
      ),
    )
    .where(
      and(
        eq(resourceSlots.resourceId, resourceId),
        eq(resourceSlots.start, start),
        slotInEffect(date),
        resourceOpenOn(date),
      ),
    )
    .then((rows) => rows[0]);

  if (!slot) {
    throw appError('NOT_FOUND', 'Unknown time slot');
  }

  if (slot.ended) {
    throw appError('SLOT_IN_PAST');
  }

  if (
    !isWithinBookingWindow(date, await getBookingWindow(member.organizationId))
  ) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  if (slot.started) {
    throw appError('SLOT_STARTED');
  }

  if (!slot.bookedBy) {
    throw appError('SLOT_AVAILABLE');
  }

  if (slot.bookedBy === member.id) {
    throw appError('HAS_ACTIVE_BOOKING');
  }

  const endsAt = slotEndsAt(
    member.timeZone,
    date,
    slot.end,
    slot.endOffsetDays,
  );
  const [row] = await db
    .insert(subscriptions)
    .values({
      organizationId: member.organizationId,
      memberId: member.id,
      date,
      start: slot.start,
      end: slot.end,
      resourceId,
      endsAt,
    })
    .onConflictDoUpdate({
      target: [
        subscriptions.memberId,
        subscriptions.resourceId,
        subscriptions.date,
        subscriptions.start,
      ],
      set: {endsAt},
    })
    .returning({
      id: subscriptions.id,
      date: subscriptions.date,
      start: subscriptions.start,
      end: subscriptions.end,
      endsAt: asIsoText(subscriptions.endsAt),
    });

  if (!row) {
    throw new Error('Insert returned no row');
  }

  return {
    ...row,
    available: false,
    started: false,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceKind: resource.kind,
  };
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

  if (!existing) {
    throw appError('NOT_FOUND', 'Subscription not found');
  }

  if (existing.memberId !== memberId) {
    throw appError('FORBIDDEN', 'Not your subscription');
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}

export function listSubscribers(
  resourceId: string,
  date: string,
  start: string,
) {
  return db
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
