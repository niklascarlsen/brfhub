import {and, asc, eq, gt, sql} from 'drizzle-orm';
import type {FastifyBaseLogger} from 'fastify';
import type {z} from 'zod';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {isUniqueViolation, type ErrorCode} from '../lib/errors.js';
import {asIsoText, slotEndsAt, slotHasEnded} from '../lib/time.js';
import type {createdBookingSchema} from '../schemas/booking.js';
import {notifySlotReleased} from './notifications.js';
import {getBookingWindow, isWithinBookingWindow} from './window.js';

const BOOKING_LOCK_NAMESPACE = 881001;

const bookingColumns = {
  id: bookings.id,
  date: bookings.date,
  slotId: bookings.slotId,
  start: timeSlots.start,
  end: timeSlots.end,
  endsAt: asIsoText(bookings.endsAt),
};

function stillActive(userId: string) {
  return and(eq(bookings.userId, userId), gt(bookings.endsAt, sql`now()`));
}

type CreatedBooking = z.infer<typeof createdBookingSchema>;

export async function releaseBooking(
  id: string,
  releasedBy: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const [released] = await db
    .delete(bookings)
    .where(eq(bookings.id, id))
    .returning({
      date: bookings.date,
      slotId: bookings.slotId,
    });

  if (!released) {
    return;
  }

  const slot = await db
    .select({start: timeSlots.start, end: timeSlots.end})
    .from(timeSlots)
    .where(eq(timeSlots.id, released.slotId))
    .then((rows) => rows[0]);

  if (!slot) {
    return;
  }

  await notifySlotReleased({...released, ...slot}, releasedBy, log);
}

type CreateBookingResult =
  {ok: true; booking: CreatedBooking} | {ok: false; code: ErrorCode};

export function listBookings(userId: string) {
  return db
    .select(bookingColumns)
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
}): Promise<CreateBookingResult> {
  const slot = await db
    .select({
      start: timeSlots.start,
      end: timeSlots.end,
      ended: slotHasEnded(date, timeSlots.end),
    })
    .from(timeSlots)
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

  try {
    const created = await db.transaction(async (tx) => {
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
    });

    if (!created) {
      return {ok: false, code: 'HAS_ACTIVE_BOOKING'};
    }

    if (created.released) {
      await notifySlotReleased(created.released, userId, log);
    }

    return {ok: true, booking: created.booking};
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {ok: false, code: 'SLOT_TAKEN'};
    }
    throw error;
  }
}
