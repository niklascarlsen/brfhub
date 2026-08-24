import {and, asc, eq, gt, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {isUniqueViolation, type DeleteResult} from '../lib/errors.js';
import {
  asIsoText,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Subscription} from './subscription.dto.js';

type CreateSubscriptionError =
  | 'NOT_FOUND'
  | 'SLOT_IN_PAST'
  | 'OUTSIDE_BOOKING_WINDOW'
  | 'SLOT_STARTED'
  | 'SLOT_AVAILABLE'
  | 'SLOT_IS_MINE'
  | 'ALREADY_SUBSCRIBED';

type CreateSubscriptionResult =
  | {ok: true; subscription: Subscription}
  | {ok: false; code: CreateSubscriptionError};

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
    })
    .from(subscriptions)
    .innerJoin(timeSlots, eq(subscriptions.slotId, timeSlots.id))
    .leftJoin(
      bookings,
      and(
        eq(bookings.slotId, subscriptions.slotId),
        eq(bookings.date, subscriptions.date),
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
}): Promise<CreateSubscriptionResult> {
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
      and(eq(bookings.slotId, timeSlots.id), eq(bookings.date, date)),
    )
    .where(eq(timeSlots.id, slotId))
    .then((rows) => rows[0]);

  if (!slot) {
    return {ok: false, code: 'NOT_FOUND'};
  }

  if (slot.ended) {
    return {ok: false, code: 'SLOT_IN_PAST'};
  }

  if (!isWithinBookingWindow(date, await getBookingWindow())) {
    return {ok: false, code: 'OUTSIDE_BOOKING_WINDOW'};
  }

  if (slot.started) {
    return {ok: false, code: 'SLOT_STARTED'};
  }

  if (!slot.bookedBy) {
    return {ok: false, code: 'SLOT_AVAILABLE'};
  }

  if (slot.bookedBy === userId) {
    return {ok: false, code: 'SLOT_IS_MINE'};
  }

  try {
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
      ok: true,
      subscription: {
        ...row,
        start: slot.start,
        end: slot.end,
        available: false,
      },
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {ok: false, code: 'ALREADY_SUBSCRIBED'};
    }
    throw error;
  }
}

export async function deleteSubscription(
  id: string,
  userId: string,
): Promise<DeleteResult> {
  const existing = await db
    .select({userId: subscriptions.userId})
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .then((rows) => rows[0]);

  if (!existing) {
    return 'NOT_FOUND';
  }

  if (existing.userId !== userId) {
    return 'FORBIDDEN';
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return 'DELETED';
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
