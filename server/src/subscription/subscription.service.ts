import {and, asc, eq, gt, isNull, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  asIsoText,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Subscription} from './subscription.dto.js';

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
    })
    .from(subscriptions)
    .innerJoin(timeSlots, eq(subscriptions.slotId, timeSlots.id))
    .leftJoin(
      bookings,
      and(
        eq(bookings.slotId, subscriptions.slotId),
        eq(bookings.date, subscriptions.date),
        isNull(bookings.releasedAt),
      ),
    )
    .where(stillActive(userId))
    .orderBy(asc(subscriptions.date), asc(timeSlots.start));
}

export async function createSubscription({
  userId,
  date,
  slotId,
}: {
  userId: string;
  date: string;
  slotId: string;
}): Promise<Subscription> {
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
    .values({date, slotId, userId, endsAt: slotEndsAt(date, slot.end)})
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

export function listSubscribers(date: string, slotId: string) {
  return db
    .select({userId: subscriptions.userId})
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.date, date),
        eq(subscriptions.slotId, slotId),
        gt(subscriptions.endsAt, sql`now()`),
      ),
    );
}
