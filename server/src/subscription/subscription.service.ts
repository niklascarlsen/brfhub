import {and, asc, eq, gt, isNull, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, resources, subscriptions, timeSlots} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  asIsoText,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import {getResource} from '../resource/resource.service.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Subscription} from './subscription.dto.js';

const resourceFields = {
  resourceId: resources.id,
  resourceName: resources.name,
  resourceKind: resources.kind,
};

function stillActive(userId: string) {
  return and(
    eq(subscriptions.userId, userId),
    gt(subscriptions.endsAt, sql`now()`),
  );
}

export function listSubscriptions(userId: string): Promise<Subscription[]> {
  return db
    .select({
      id: subscriptions.id,
      date: subscriptions.date,
      slotId: subscriptions.slotId,
      start: timeSlots.start,
      end: timeSlots.end,
      endsAt: asIsoText(subscriptions.endsAt),
      available: sql<boolean>`${bookings.id} is null`,
      started: slotHasStarted(subscriptions.date, timeSlots.start),
      ...resourceFields,
    })
    .from(subscriptions)
    .innerJoin(timeSlots, eq(subscriptions.slotId, timeSlots.id))
    .innerJoin(resources, eq(subscriptions.resourceId, resources.id))
    .leftJoin(
      bookings,
      and(
        eq(bookings.slotId, subscriptions.slotId),
        eq(bookings.resourceId, subscriptions.resourceId),
        eq(bookings.date, subscriptions.date),
        isNull(bookings.releasedAt),
      ),
    )
    .where(stillActive(userId))
    .orderBy(
      asc(subscriptions.date),
      asc(timeSlots.start),
      asc(resources.sortOrder),
    );
}

export async function createSubscription({
  userId,
  date,
  slotId,
  resourceId,
}: {
  userId: string;
  date: string;
  slotId: string;
  resourceId: string;
}): Promise<Subscription> {
  const resource = await getResource(resourceId);
  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  const slot = await db
    .select({
      start: timeSlots.start,
      end: timeSlots.end,
      ended: slotHasEnded(date, timeSlots.end),
      started: slotHasStarted(date, timeSlots.start),
      bookedBy: bookings.userId,
    })
    .from(timeSlots)
    .leftJoin(
      bookings,
      and(
        eq(bookings.slotId, timeSlots.id),
        eq(bookings.resourceId, resourceId),
        eq(bookings.date, date),
        isNull(bookings.releasedAt),
      ),
    )
    .where(eq(timeSlots.id, slotId))
    .then((rows) => rows[0]);

  if (!slot) {
    throw appError('NOT_FOUND', 'Unknown time slot');
  }

  if (slot.ended) {
    throw appError('SLOT_IN_PAST');
  }

  if (!isWithinBookingWindow(date, await getBookingWindow())) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  if (slot.started) {
    throw appError('SLOT_STARTED');
  }

  if (!slot.bookedBy) {
    throw appError('SLOT_AVAILABLE');
  }

  const [row] = await db
    .insert(subscriptions)
    .values({
      date,
      slotId,
      resourceId,
      userId,
      endsAt: slotEndsAt(date, slot.end),
    })
    .returning({
      id: subscriptions.id,
      date: subscriptions.date,
      slotId: subscriptions.slotId,
      endsAt: asIsoText(subscriptions.endsAt),
    });

  if (!row) {
    throw new Error('Insert returned no row');
  }

  return {
    ...row,
    start: slot.start,
    end: slot.end,
    available: false,
    started: false,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceKind: resource.kind,
  };
}

export async function deleteSubscription(
  id: string,
  userId: string,
): Promise<void> {
  const existing = await db
    .select({userId: subscriptions.userId})
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .then((rows) => rows[0]);

  if (!existing) {
    throw appError('NOT_FOUND', 'Subscription not found');
  }

  if (existing.userId !== userId) {
    throw appError('FORBIDDEN', 'Not your subscription');
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}

export function listSubscribers(
  resourceId: string,
  date: string,
  slotId: string,
) {
  return db
    .select({userId: subscriptions.userId})
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.resourceId, resourceId),
        eq(subscriptions.date, date),
        eq(subscriptions.slotId, slotId),
        gt(subscriptions.endsAt, sql`now()`),
      ),
    );
}
