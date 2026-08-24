import {and, asc, eq, gt, sql} from 'drizzle-orm';
import type {FastifyBaseLogger} from 'fastify';

import {isUniqueViolation} from '../db/errors.js';
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
import type {Booking, CreatedBooking} from './booking.dto.js';
import {notifySlotReleased} from './booking.notification.js';

const BOOKING_LOCK_NAMESPACE = 881001;

function stillActive(userId: string) {
  return and(eq(bookings.userId, userId), gt(bookings.endsAt, sql`now()`));
}

export async function deleteBooking(
  id: string,
  userId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const existing = await db
    .select({userId: bookings.userId})
    .from(bookings)
    .where(eq(bookings.id, id))
    .then((rows) => rows[0]);

  if (!existing) {
    throw appError('NOT_FOUND', 'Booking not found');
  }

  if (existing.userId !== userId) {
    throw appError('FORBIDDEN', 'Not your booking');
  }

  const [released] = await db
    .delete(bookings)
    .where(eq(bookings.id, id))
    .returning({
      date: bookings.date,
      slotId: bookings.slotId,
    });

  if (!released) {
    throw appError('NOT_FOUND', 'Booking not found');
  }

  const slot = await db
    .select({start: timeSlots.start, end: timeSlots.end})
    .from(timeSlots)
    .where(eq(timeSlots.id, released.slotId))
    .then((rows) => rows[0]);

  if (slot) {
    await notifySlotReleased({...released, ...slot}, userId, log);
  }
}

export function listBookings(userId: string): Promise<Booking[]> {
  return db
    .select({
      id: bookings.id,
      date: bookings.date,
      slotId: bookings.slotId,
      start: timeSlots.start,
      end: timeSlots.end,
      endsAt: asIsoText(bookings.endsAt),
    })
    .from(bookings)
    .innerJoin(timeSlots, eq(bookings.slotId, timeSlots.id))
    .where(stillActive(userId))
    .orderBy(asc(bookings.date), asc(timeSlots.start));
}

export async function createBooking({
  userId,
  date,
  slotId,
  replaceExisting,
  log,
}: {
  userId: string;
  date: string;
  slotId: string;
  replaceExisting: boolean;
  log: FastifyBaseLogger;
}): Promise<CreatedBooking> {
  const slot = await db
    .select({
      start: timeSlots.start,
      end: timeSlots.end,
      ended: slotHasEnded(date, timeSlots.end),
      started: slotHasStarted(date, timeSlots.start),
    })
    .from(timeSlots)
    .where(eq(timeSlots.id, slotId))
    .then((rows) => rows[0]);

  if (!slot) {
    throw appError('NOT_FOUND', 'Unknown time slot');
  }

  if (slot.ended) {
    throw appError('SLOT_IN_PAST');
  }

  if (slot.started) {
    throw appError('SLOT_STARTED');
  }

  if (!isWithinBookingWindow(date, await getBookingWindow())) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  const created = await db
    .transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${BOOKING_LOCK_NAMESPACE}, hashtext(${userId}))`,
      );

      const [active] = await tx
        .select({
          id: bookings.id,
          date: bookings.date,
          slotId: bookings.slotId,
          start: timeSlots.start,
          end: timeSlots.end,
        })
        .from(bookings)
        .innerJoin(timeSlots, eq(bookings.slotId, timeSlots.id))
        .where(stillActive(userId))
        .limit(1);

      if (active && !replaceExisting) {
        return undefined;
      }

      if (active) {
        await tx.delete(bookings).where(eq(bookings.id, active.id));
      }

      const [row] = await tx
        .insert(bookings)
        .values({date, slotId, userId, endsAt: slotEndsAt(date, slot.end)})
        .returning({
          id: bookings.id,
          date: bookings.date,
          slotId: bookings.slotId,
          endsAt: asIsoText(bookings.endsAt),
        });

      if (!row) {
        throw new Error('Insert returned no row');
      }

      await tx
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.date, date),
            eq(subscriptions.slotId, slotId),
          ),
        );

      return {
        booking: {
          ...row,
          start: slot.start,
          end: slot.end,
          replacedId: active?.id ?? null,
        },
        released: active
          ? {
              date: active.date,
              slotId: active.slotId,
              start: active.start,
              end: active.end,
            }
          : null,
      };
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw appError('SLOT_TAKEN');
      }
      throw error;
    });

  if (!created) {
    throw appError('HAS_ACTIVE_BOOKING');
  }

  if (created.released) {
    await notifySlotReleased(created.released, userId, log);
  }

  return created.booking;
}
