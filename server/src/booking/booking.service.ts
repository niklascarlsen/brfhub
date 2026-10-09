import {and, asc, eq, sql} from 'drizzle-orm';
import type {FastifyBaseLogger} from 'fastify';

import {isUniqueViolation} from '../db/errors.js';
import {db} from '../db/index.js';
import {
  bookings,
  resourceSlots,
  resources,
  subscriptions,
  user,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  asIsoText,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {getResource} from '../resource/resource.service.js';
import {resourceOpenOn, slotInEffect} from '../resource/schedule.query.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Booking, CreatedBooking} from './booking.dto.js';
import {lockApartmentBookings, stillActive} from './booking.query.js';
import {notifySlotReleased} from './booking.notification.js';

const resourceFields = {
  resourceId: resources.id,
  resourceName: resources.name,
  resourceKind: resources.kindId,
};

export async function deleteBooking(
  id: string,
  memberId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const [existing] = await db
    .select({
      memberId: bookings.memberId,
      date: bookings.date,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
      releasedAt: bookings.releasedAt,
      started: slotHasStarted(bookings.date, bookings.start),
      start: bookings.start,
      end: bookings.end,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(eq(bookings.id, id));

  if (!existing) {
    throw appError('NOT_FOUND', 'Booking not found');
  }

  if (existing.memberId !== memberId) {
    throw appError('FORBIDDEN', 'Not your booking');
  }

  if (existing.releasedAt) {
    return;
  }

  if (existing.started) {
    await db
      .update(bookings)
      .set({releasedAt: sql`now()`})
      .where(eq(bookings.id, id));

    return;
  }

  const [removed] = await db
    .delete(bookings)
    .where(eq(bookings.id, id))
    .returning({
      date: bookings.date,
      start: bookings.start,
    });

  if (!removed) {
    throw appError('NOT_FOUND', 'Booking not found');
  }

  await notifySlotReleased(
    {
      ...removed,
      resourceId: existing.resourceId,
      resourceName: existing.resourceName,
      end: existing.end,
    },
    memberId,
    log,
  );
}

export function listBookings(memberId: string): Promise<Booking[]> {
  return db
    .select({
      id: bookings.id,
      date: bookings.date,
      start: bookings.start,
      end: bookings.end,
      endsAt: asIsoText(bookings.endsAt),
      started: slotHasStarted(bookings.date, bookings.start),
      released: sql<boolean>`${bookings.releasedAt} is not null`,
      ...resourceFields,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(stillActive(memberId))
    .orderBy(asc(bookings.date), asc(bookings.start), asc(resources.sortOrder));
}

export async function createBooking({
  member,
  date,
  start,
  resourceId,
  replaceExisting,
  log,
}: {
  member: Member;
  date: string;
  start: string;
  resourceId: string;
  replaceExisting: boolean;
  log: FastifyBaseLogger;
}): Promise<CreatedBooking> {
  const resource = await getResource(member.organizationId, resourceId);
  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  const [slot] = await db
    .select({
      start: resourceSlots.start,
      end: resourceSlots.end,
      endOffsetDays: resourceSlots.endOffsetDays,
      ended: slotHasEnded(date, resourceSlots.end, resourceSlots.endOffsetDays),
      started: slotHasStarted(date, resourceSlots.start),
    })
    .from(resourceSlots)
    .innerJoin(resources, eq(resources.id, resourceSlots.resourceId))
    .where(
      and(
        eq(resourceSlots.resourceId, resourceId),
        eq(resourceSlots.start, start),
        slotInEffect(date),
        resourceOpenOn(date),
      ),
    );

  if (!slot) {
    throw appError('NOT_FOUND', 'Unknown time slot');
  }

  if (slot.ended) {
    throw appError('SLOT_IN_PAST');
  }

  if (slot.started) {
    throw appError('SLOT_STARTED');
  }

  if (
    !isWithinBookingWindow(date, await getBookingWindow(member.organizationId))
  ) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  const created = await db
    .transaction(async (tx) => {
      await lockApartmentBookings(tx, member.id);

      // The residents may have changed while this request waited for the
      // lock: an account that no longer holds the apartment books nothing.
      const [holder] = await tx
        .select({id: user.id})
        .from(user)
        .where(and(eq(user.id, member.userId), eq(user.memberId, member.id)));

      if (!holder) {
        throw appError('UNAUTHORIZED', 'Unknown member');
      }

      const active = await tx
        .select({
          id: bookings.id,
          date: bookings.date,
          start: bookings.start,
          end: bookings.end,
          resourceId: bookings.resourceId,
          resourceName: resources.name,
          releasedAt: bookings.releasedAt,
        })
        .from(bookings)
        .innerJoin(resources, eq(bookings.resourceId, resources.id))
        .where(
          and(stillActive(member.id), eq(resources.kindId, resource.kind)),
        );

      let replaced: (typeof active)[number] | null = null;

      if (active.length >= resource.maxActive) {
        const [existing] = active;

        if (
          resource.maxActive !== 1 ||
          !replaceExisting ||
          !existing ||
          existing.releasedAt
        ) {
          return undefined;
        }

        replaced = existing;
        await tx.delete(bookings).where(eq(bookings.id, existing.id));
      }

      const [row] = await tx
        .insert(bookings)
        .values({
          organizationId: member.organizationId,
          memberId: member.id,
          date,
          start: slot.start,
          end: slot.end,
          resourceId,
          endsAt: slotEndsAt(date, slot.end, slot.endOffsetDays),
        })
        .returning({
          id: bookings.id,
          date: bookings.date,
          start: bookings.start,
          endsAt: asIsoText(bookings.endsAt),
        });

      if (!row) {
        throw new Error('Insert returned no row');
      }

      await tx
        .delete(subscriptions)
        .where(
          and(
            eq(subscriptions.memberId, member.id),
            eq(subscriptions.resourceId, resourceId),
            eq(subscriptions.date, date),
            eq(subscriptions.start, slot.start),
          ),
        );

      return {
        booking: {
          ...row,
          end: slot.end,
          started: false,
          released: false,
          resourceId: resource.id,
          resourceName: resource.name,
          resourceKind: resource.kind,
          replacedId: replaced?.id ?? null,
        },
        replaced,
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

  if (created.replaced) {
    await notifySlotReleased(created.replaced, member.id, log);
  }

  return created.booking;
}
