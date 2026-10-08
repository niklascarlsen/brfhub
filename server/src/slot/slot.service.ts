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
import {
  asDateText,
  bookingWindowSql,
  slotEndsAt,
  slotHasStarted,
} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {
  getResource,
  listBookableResources,
  type BookableResource,
} from '../resource/resource.service.js';
import type {BookingWindow, ResourceSchedule, Slot, Slots} from './slot.dto.js';

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

// Without a resource id it returns the slots of every resource in the
// organization, ordered as the resources are.
function selectSlotRows(
  member: Member,
  from: string,
  to: string,
  resourceId?: string,
) {
  // WITH days AS (one row per day in the range). generate_series has no query-builder form, so this block stays raw SQL.)
  const days = db
    .$with('days')
    .as(
      db
        .select({day: sql<string>`day::date`.as('day')})
        .from(
          sql`generate_series(${from}::date, ${to}::date, interval '1 day') as day`,
        ),
    );

  return db
    .with(days)
    .select({
      resourceId: resourceSlots.resourceId,
      date: asDateText(days.day),
      start: resourceSlots.start,
      end: resourceSlots.end,
      started: slotHasStarted(days.day, resourceSlots.start),
      bookingId: bookings.id,
      bookingMemberId: bookings.memberId,
      subscriptionId: subscriptions.id,
    })
    .from(resourceSlots)
    .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
    .crossJoin(days)
    .leftJoin(
      bookings,
      and(
        eq(bookings.resourceId, resourceSlots.resourceId),
        eq(bookings.start, resourceSlots.start),
        eq(bookings.date, days.day),
        isNull(bookings.releasedAt),
      ),
    )
    .leftJoin(
      subscriptions,
      and(
        eq(subscriptions.resourceId, resourceSlots.resourceId),
        eq(subscriptions.start, resourceSlots.start),
        eq(subscriptions.date, days.day),
        eq(subscriptions.memberId, member.id),
      ),
    )
    .where(
      and(
        eq(resources.organizationId, member.organizationId),
        resourceId ? eq(resourceSlots.resourceId, resourceId) : undefined,
        sql`${slotEndsAt(days.day, resourceSlots.end, resourceSlots.endOffsetDays)} > now()`,
      ),
    )
    .orderBy(asc(resources.sortOrder), asc(days.day), asc(resourceSlots.start));
}

type SlotRow = Awaited<ReturnType<typeof selectSlotRows>>[number];

function toSlot(row: SlotRow, memberId: string): Slot {
  if (!row.bookingId) {
    if (row.started) {
      return {
        date: row.date,
        start: row.start,
        end: row.end,
        status: 'walkin',
      };
    }

    return {
      date: row.date,
      start: row.start,
      end: row.end,
      status: 'available',
      subscriptionId: row.subscriptionId,
    };
  }

  if (row.bookingMemberId === memberId) {
    return {
      date: row.date,
      start: row.start,
      end: row.end,
      status: 'mine',
      bookingId: row.bookingId,
      started: row.started,
    };
  }

  return {
    date: row.date,
    start: row.start,
    end: row.end,
    status: 'booked',
    started: row.started,
    subscriptionId: row.subscriptionId,
  };
}

// Only a kind that allows one booking at a time reports it, since that is
// when booking another slot of the kind has to swap.
type ActiveByKind = Map<string, {released: boolean}>;

async function selectActiveByKind(memberId: string): Promise<ActiveByKind> {
  const rows = await db
    .select({
      kind: resources.kindId,
      released: sql<boolean>`${bookings.releasedAt} is not null`,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(stillActive(memberId));

  return new Map(rows.map((row) => [row.kind, {released: row.released}]));
}

function activeFor(resource: BookableResource, activeByKind: ActiveByKind) {
  return resource.maxActive === 1
    ? (activeByKind.get(resource.kind) ?? null)
    : null;
}

async function assertWithinBookingWindow(
  organizationId: string,
  from: string,
  to: string,
) {
  if (to < from) {
    throw appError('VALIDATION', 'to must not be before date');
  }

  const window = await getBookingWindow(organizationId);

  if (
    !isWithinBookingWindow(from, window) ||
    !isWithinBookingWindow(to, window)
  ) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }
}

export async function listSlots({
  member,
  date,
  to,
  resourceId,
}: {
  member: Member;
  date: string;
  to?: string;
  resourceId: string;
}): Promise<Slots> {
  const resource = await getResource(member.organizationId, resourceId);

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  const last = to ?? date;
  await assertWithinBookingWindow(member.organizationId, date, last);

  const [rows, activeByKind] = await Promise.all([
    selectSlotRows(member, date, last, resourceId),
    selectActiveByKind(member.id),
  ]);

  return {
    slots: rows.map((row) => toSlot(row, member.id)),
    active: activeFor(resource, activeByKind),
  };
}

export async function listSchedule({
  member,
  from,
  to,
}: {
  member: Member;
  from: string;
  to: string;
}): Promise<ResourceSchedule[]> {
  await assertWithinBookingWindow(member.organizationId, from, to);

  const [bookable, rows, activeByKind] = await Promise.all([
    listBookableResources(member.organizationId),
    selectSlotRows(member, from, to),
    selectActiveByKind(member.id),
  ]);

  return bookable.map((resource) => ({
    resourceId: resource.id,
    slots: rows
      .filter((row) => row.resourceId === resource.id)
      .map((row) => toSlot(row, member.id)),
    active: activeFor(resource, activeByKind),
  }));
}
