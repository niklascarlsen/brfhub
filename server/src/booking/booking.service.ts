import {and, asc, eq, sql} from 'drizzle-orm';
import type {FastifyBaseLogger} from 'fastify';

import {isUniqueViolation} from '../db/errors.js';
import {db} from '../db/index.js';
import {bookings, resources, subscriptions, timeSlots} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  asIsoText,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import {getResource} from '../resource/resource.service.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Booking, CreatedBooking} from './booking.dto.js';
import {stillActive} from './booking.query.js';
import {notifySlotReleased} from './booking.notification.js';

const BOOKING_LOCK_NAMESPACE = 881001;

const resourceFields = {
  resourceId: resources.id,
  resourceName: resources.name,
  resourceKind: resources.kind,
};

export async function deleteBooking(
  id: string,
  userId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  const [existing] = await db
    .select({
      userId: bookings.userId,
      date: bookings.date,
      slotId: bookings.slotId,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
      releasedAt: bookings.releasedAt,
      started: slotHasStarted(bookings.date, timeSlots.start),
      start: timeSlots.start,
      end: timeSlots.end,
    })
    .from(bookings)
    .innerJoin(timeSlots, eq(bookings.slotId, timeSlots.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(eq(bookings.id, id));

  if (!existing) {
    throw appError('NOT_FOUND', 'Booking not found');
  }

  if (existing.userId !== userId) {
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
      slotId: bookings.slotId,
    });

  if (!removed) {
    throw appError('NOT_FOUND', 'Booking not found');
  }

  await notifySlotReleased(
    {
      ...removed,
      resourceId: existing.resourceId,
      resourceName: existing.resourceName,
      start: existing.start,
      end: existing.end,
    },
    userId,
    log,
  );
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
      started: slotHasStarted(bookings.date, timeSlots.start),
      released: sql<boolean>`${bookings.releasedAt} is not null`,
      ...resourceFields,
    })
    .from(bookings)
    .innerJoin(timeSlots, eq(bookings.slotId, timeSlots.id))
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(stillActive(userId))
    .orderBy(
      asc(bookings.date),
      asc(timeSlots.start),
      asc(resources.sortOrder),
    );
}

export async function createBooking({
  userId,
  date,
  slotId,
  resourceId,
  replaceExisting,
  log,
}: {
  userId: string;
  date: string;
  slotId: string;
  resourceId: string;
  replaceExisting: boolean;
  log: FastifyBaseLogger;
}): Promise<CreatedBooking> {
  const resource = await getResource(resourceId);
  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  const [slot] = await db
    .select({
      start: timeSlots.start,
      end: timeSlots.end,
      ended: slotHasEnded(date, timeSlots.end),
      started: slotHasStarted(date, timeSlots.start),
    })
    .from(timeSlots)
    .where(eq(timeSlots.id, slotId));

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
          resourceId: bookings.resourceId,
          resourceName: resources.name,
          start: timeSlots.start,
          end: timeSlots.end,
          releasedAt: bookings.releasedAt,
        })
        .from(bookings)
        .innerJoin(timeSlots, eq(bookings.slotId, timeSlots.id))
        .innerJoin(resources, eq(bookings.resourceId, resources.id))
        .where(and(stillActive(userId), eq(resources.kind, resource.kind)))
        .limit(1);

      if (active && (active.releasedAt || !replaceExisting)) {
        return undefined;
      }

      if (active) {
        await tx.delete(bookings).where(eq(bookings.id, active.id));
      }

      const [row] = await tx
        .insert(bookings)
        .values({
          date,
          slotId,
          resourceId,
          userId,
          endsAt: slotEndsAt(date, slot.end),
        })
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
            eq(subscriptions.resourceId, resourceId),
            eq(subscriptions.date, date),
            eq(subscriptions.slotId, slotId),
          ),
        );

      return {
        booking: {
          ...row,
          start: slot.start,
          end: slot.end,
          started: false,
          released: false,
          resourceId: resource.id,
          resourceName: resource.name,
          resourceKind: resource.kind,
          replacedId: active?.id ?? null,
        },
        replaced: active
          ? {
              date: active.date,
              slotId: active.slotId,
              resourceId: active.resourceId,
              resourceName: active.resourceName,
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

  if (created.replaced) {
    await notifySlotReleased(created.replaced, userId, log);
  }

  return created.booking;
}
