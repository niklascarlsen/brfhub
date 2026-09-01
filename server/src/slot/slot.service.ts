import {and, asc, eq, isNull, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {bookingWindowSql, slotEndsAt, slotHasStarted} from '../lib/time.js';
import {getResource} from '../resource/resource.service.js';
import type {BookingWindow, Slot} from './slot.dto.js';

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

function selectSlotRows(userId: string, date: string, resourceId: string) {
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
      and(
        eq(bookings.slotId, timeSlots.id),
        eq(bookings.resourceId, resourceId),
        eq(bookings.date, date),
        isNull(bookings.releasedAt),
      ),
    )
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.slotId, timeSlots.id),
        eq(subscriptions.resourceId, resourceId),
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
    if (row.started) {
      return {
        id: row.id,
        start: row.start,
        end: row.end,
        status: 'walkin',
      };
    }

    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: 'available',
      subscriptionId: row.subscriptionId,
    };
  }

  if (row.bookingUserId === userId) {
    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: 'mine',
      bookingId: row.bookingId,
      started: row.started,
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
  resourceId,
}: {
  userId: string;
  date: string;
  resourceId: string;
}): Promise<Slot[]> {
  if (!(await getResource(resourceId))) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  if (!isWithinBookingWindow(date, await getBookingWindow())) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  const rows = await selectSlotRows(userId, date, resourceId);

  return rows.map((row) => toSlot(row, userId));
}
