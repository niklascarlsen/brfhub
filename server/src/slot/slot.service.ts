import {and, asc, eq, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {bookingWindowSql, slotEndsAt, slotHasStarted} from '../lib/time.js';
import type {BookingWindow, Slot} from './slot.dto.js';

type ListSlotsError = 'OUTSIDE_BOOKING_WINDOW';

type ListSlotsResult =
  | {ok: true; slots: Slot[]}
  | {ok: false; code: ListSlotsError};

export async function getBookingWindow(): Promise<BookingWindow> {
  const {today, from, to} = bookingWindowSql();
  const result = await db.execute<BookingWindow>(
    sql`select ${today} as "today", ${from} as "from", ${to} as "to"`,
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Booking window query returned no row');
  }

  return row;
}

export function isWithinBookingWindow(
  date: string,
  window: BookingWindow,
): boolean {
  return date >= window.from && date <= window.to;
}

function selectSlotRows(userId: string, date: string) {
  return db
    .select({
      id: timeSlots.id,
      start: timeSlots.start,
      end: timeSlots.end,
      started: slotHasStarted(date, timeSlots.start),
      bookingId: bookings.id,
      bookingUserId: bookings.userId,
      subscriptionId: subscriptions.id,
    })
    .from(timeSlots)
    .leftJoin(
      bookings,
      and(eq(bookings.slotId, timeSlots.id), eq(bookings.date, date)),
    )
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.slotId, timeSlots.id),
        eq(subscriptions.date, date),
        eq(subscriptions.userId, userId),
      ),
    )
    .where(sql`${slotEndsAt(date, timeSlots.end)} > now()`)
    .orderBy(asc(timeSlots.start));
}

type SlotRow = Awaited<ReturnType<typeof selectSlotRows>>[number];

function toSlot(row: SlotRow, userId: string): Slot {
  if (!row.bookingId) {
    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: row.started ? 'walkin' : 'available',
    };
  }

  if (row.bookingUserId === userId) {
    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: 'mine',
      bookingId: row.bookingId,
    };
  }

  return {
    id: row.id,
    start: row.start,
    end: row.end,
    status: 'booked',
    started: row.started,
    subscriptionId: row.subscriptionId,
  };
}

export async function listSlots({
  userId,
  date,
}: {
  userId: string;
  date: string;
}): Promise<ListSlotsResult> {
  if (!isWithinBookingWindow(date, await getBookingWindow())) {
    return {ok: false, code: 'OUTSIDE_BOOKING_WINDOW'};
  }

  const rows = await selectSlotRows(userId, date);

  return {ok: true, slots: rows.map((row) => toSlot(row, userId))};
}
