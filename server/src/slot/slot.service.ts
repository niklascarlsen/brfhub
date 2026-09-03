import {and, asc, eq, isNull, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {
  bookings,
  organizations,
  resourceSlots,
  resources,
  subscriptions,
} from '../db/schema.js';
import {stillActive} from '../booking/booking.query.js';
import {appError} from '../lib/errors.js';
import {bookingWindowSql, slotEndsAt, slotHasStarted} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {
  getResource,
  type BookableResource,
} from '../resource/resource.service.js';
import type {BookingWindow, Slot, Slots} from './slot.dto.js';

export async function getBookingWindow(
  organizationId: string,
): Promise<BookingWindow> {
  const {today, from, to} = bookingWindowSql(organizations.bookingWindowDays);
  const [row] = await db
    .select({today, from, to})
    .from(organizations)
    .where(eq(organizations.id, organizationId));

  if (!row) {
    throw new Error(`Unknown organization ${organizationId}`);
  }

  return row;
}

export function isWithinBookingWindow(
  date: string,
  window: BookingWindow,
): boolean {
  return date >= window.from && date <= window.to;
}

function selectSlotRows(memberId: string, date: string, resourceId: string) {
  return db
    .select({
      start: resourceSlots.start,
      end: resourceSlots.end,
      started: slotHasStarted(date, resourceSlots.start),
      bookingId: bookings.id,
      bookingMemberId: bookings.memberId,
      subscriptionId: subscriptions.id,
    })
    .from(resourceSlots)
    .leftJoin(
      bookings,
      and(
        eq(bookings.resourceId, resourceSlots.resourceId),
        eq(bookings.start, resourceSlots.start),
        eq(bookings.date, date),
        isNull(bookings.releasedAt),
      ),
    )
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.resourceId, resourceSlots.resourceId),
        eq(subscriptions.start, resourceSlots.start),
        eq(subscriptions.date, date),
        eq(subscriptions.memberId, memberId),
      ),
    )
    .where(
      and(
        eq(resourceSlots.resourceId, resourceId),
        sql`${slotEndsAt(date, resourceSlots.end, resourceSlots.endOffsetDays)} > now()`,
      ),
    )
    .orderBy(asc(resourceSlots.start));
}

type SlotRow = Awaited<ReturnType<typeof selectSlotRows>>[number];

function toSlot(row: SlotRow, memberId: string): Slot {
  if (!row.bookingId) {
    if (row.started) {
      return {
        start: row.start,
        end: row.end,
        status: 'walkin',
      };
    }

    return {
      start: row.start,
      end: row.end,
      status: 'available',
      subscriptionId: row.subscriptionId,
    };
  }

  if (row.bookingMemberId === memberId) {
    return {
      start: row.start,
      end: row.end,
      status: 'mine',
      bookingId: row.bookingId,
      started: row.started,
    };
  }

  return {
    start: row.start,
    end: row.end,
    status: 'booked',
    started: row.started,
    subscriptionId: row.subscriptionId,
  };
}

async function selectActiveBooking(
  memberId: string,
  resource: BookableResource,
) {
  if (resource.maxActive !== 1) {
    return null;
  }

  const [row] = await db
    .select({released: sql<boolean>`${bookings.releasedAt} is not null`})
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(and(stillActive(memberId), eq(resources.kindId, resource.kind)))
    .limit(1);

  return row ?? null;
}

export async function listSlots({
  member,
  date,
  resourceId,
}: {
  member: Member;
  date: string;
  resourceId: string;
}): Promise<Slots> {
  const resource = await getResource(member.organizationId, resourceId);

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  if (
    !isWithinBookingWindow(date, await getBookingWindow(member.organizationId))
  ) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  const [rows, active] = await Promise.all([
    selectSlotRows(member.id, date, resourceId),
    selectActiveBooking(member.id, resource),
  ]);

  return {slots: rows.map((row) => toSlot(row, member.id)), active};
}
