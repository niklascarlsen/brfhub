import {and, asc, eq, gt, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, timeSlots} from '../db/schema.js';
import {isUniqueViolation, type ErrorCode} from '../lib/errors.js';
import {asIsoText, slotEndsAt, slotHasEnded} from '../lib/time.js';
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

export type CreateBookingInput = {
  userId: string;
  date: string;
  slotId: string;
  replaceExisting: boolean;
};

export type CreatedBooking = {
  id: string;
  date: string;
  slotId: string;
  start: string;
  end: string;
  endsAt: string;
  replacedId: string | null;
};

export type CreateBookingResult =
  | {ok: true; booking: CreatedBooking}
  | {
      ok: false;
      code: Extract<
        ErrorCode,
        | 'NOT_FOUND'
        | 'SLOT_IN_PAST'
        | 'OUTSIDE_BOOKING_WINDOW'
        | 'HAS_ACTIVE_BOOKING'
        | 'SLOT_TAKEN'
      >;
    };

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
}: CreateBookingInput): Promise<CreateBookingResult> {
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
        .select({id: bookings.id})
        .from(bookings)
        .where(stillActive(userId))
        .limit(1);

      if (active && !replaceExisting) {
        return undefined;
      }

      if (active) {
        await tx.delete(bookings).where(stillActive(userId));
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

      return {
        ...row,
        start: slot.start,
        end: slot.end,
        replacedId: active?.id ?? null,
      };
    });

    if (!created) {
      return {ok: false, code: 'HAS_ACTIVE_BOOKING'};
    }

    return {ok: true, booking: created};
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {ok: false, code: 'SLOT_TAKEN'};
    }
    throw error;
  }
}
