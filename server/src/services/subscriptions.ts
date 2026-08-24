import {and, asc, eq, gt, sql} from 'drizzle-orm';
import type {z} from 'zod';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {isUniqueViolation, type ErrorCode} from '../lib/errors.js';
import {
  asIsoText,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import type {subscriptionSchema} from '../schemas/subscription.js';
import {getBookingWindow, isWithinBookingWindow} from './window.js';

type Subscription = z.infer<typeof subscriptionSchema>;

type CreateSubscriptionResult =
  | {ok: true; subscription: Subscription}
  | {ok: false; code: ErrorCode};

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

  if (!slot.bookedBy) {
    return {ok: false, code: slot.started ? 'SLOT_STARTED' : 'SLOT_AVAILABLE'};
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

export async function deleteSubscription(id: string, userId: string) {
  const existing = await db
    .select({userId: subscriptions.userId})
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .then((rows) => rows[0]);

  if (!existing) {
    return 'NOT_FOUND' as const;
  }

  if (existing.userId !== userId) {
    return 'FORBIDDEN' as const;
  }

  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return 'DELETED' as const;
}

export function subscribersOf(date: string, slotId: string) {
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
