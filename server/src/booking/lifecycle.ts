import {and, eq, isNull, sql} from 'drizzle-orm';

import {isUniqueViolation} from '../db/errors.js';
import {db, type Transaction} from '../db/index.js';
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
  currentTime,
  slotEndsAt,
  slotHasEnded,
  slotHasStarted,
} from '../lib/time.js';
import type {Member, Organization} from '../lib/user.js';
import type {
  Notifier,
  Recipients,
} from '../notification/notification.service.js';
import {
  getResource,
  type BookableResource,
} from '../resource/resource.service.js';
import {resourceOpenOn, slotInEffect} from '../resource/schedule.query.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Subscription} from '../subscription/subscription.dto.js';
import type {CreatedBooking} from './booking.dto.js';
import {announceReleased, queueOf} from './booking.notification.js';
import {stillActive} from './booking.query.js';

// How a booking begins and ends: booking a slot, queueing for one another
// apartment holds, letting one go, and an apartment letting all of its go.
// Each decides in one transaction under the apartment's lock, judging the
// clock after it, and tells the queue of a freed slot once that has
// committed.

const BOOKING_LOCK_NAMESPACE = 881001;

// Held for the rest of the transaction by whatever changes an apartment's
// bookings or residents, so they never interleave. Taken before anything
// else: a booking's insert then locks the apartment's row, and a
// transaction that took the row first would deadlock with it.
export async function lockApartmentBookings(
  tx: Transaction,
  memberId: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${BOOKING_LOCK_NAMESPACE}, hashtext(${memberId}))`,
  );
}

// The residents may have changed while the request waited for the lock:
// an account that no longer holds the apartment changes nothing.
async function assertHolder(tx: Transaction, member: Member): Promise<void> {
  const [holder] = await tx
    .select({id: user.id})
    .from(user)
    .where(and(eq(user.id, member.userId), eq(user.memberId, member.id)));

  if (!holder) {
    throw appError('UNAUTHORIZED', 'Unknown member');
  }
}

type Slot = {start: string; end: string; endOffsetDays: number};

// The slot a resource offers at that start on that day, as long as it can
// still be booked or queued for.
async function openSlot(
  tx: Transaction,
  member: Member,
  resourceId: string,
  date: string,
  start: string,
): Promise<Slot> {
  const [slot] = await tx
    .select({
      start: resourceSlots.start,
      end: resourceSlots.end,
      endOffsetDays: resourceSlots.endOffsetDays,
      ended: slotHasEnded(
        member.timeZone,
        date,
        resourceSlots.end,
        resourceSlots.endOffsetDays,
      ),
      started: slotHasStarted(member.timeZone, date, resourceSlots.start),
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

  const window = await getBookingWindow(member.organizationId, tx);
  if (!isWithinBookingWindow(date, window)) {
    throw appError('OUTSIDE_BOOKING_WINDOW');
  }

  return slot;
}

async function bookableResource(
  member: Member,
  resourceId: string,
): Promise<BookableResource> {
  const resource = await getResource(member, resourceId);

  if (!resource) {
    throw appError('NOT_FOUND', 'Unknown resource');
  }

  return resource;
}

// An apartment's bookings as ending them needs them, with whether each
// has started judged now, under the lock.
function selectHeld(tx: Transaction, timeZone: string) {
  return tx
    .select({
      id: bookings.id,
      memberId: bookings.memberId,
      date: bookings.date,
      start: bookings.start,
      end: bookings.end,
      resourceId: bookings.resourceId,
      resourceName: resources.name,
      started: slotHasStarted(timeZone, bookings.date, bookings.start),
      released: sql<boolean>`${bookings.releasedAt} is not null`,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id));
}

type Held = Awaited<ReturnType<typeof selectHeld>>[number];

// The apartment that lets a booking go, whose own queue place on the slot
// is not told about it.
type ReleasedBy = Pick<Organization, 'locales'> & {id: string};

// Deletes a booking and finds who to tell of its slot. A queue place being
// taken on the slot holds the booking until it is in, so the lookup after
// the delete finds it.
async function free(
  tx: Transaction,
  booking: Held,
  releasedBy: ReleasedBy,
): Promise<Recipients | null> {
  await tx.delete(bookings).where(eq(bookings.id, booking.id));

  // Nobody can book a slot that has started, so its queue is not told.
  return booking.started ? null : queueOf(tx, booking, releasedBy);
}

// Ends a booking the way cancelling does: one that has started stays,
// open for walk-in and counting against the apartment until it ends, and
// any other is freed.
async function letGo(
  tx: Transaction,
  booking: Held,
  releasedBy: ReleasedBy,
): Promise<Recipients | null> {
  if (booking.released) {
    return null;
  }

  if (booking.started) {
    await tx
      .update(bookings)
      .set({releasedAt: currentTime()})
      .where(eq(bookings.id, booking.id));
    return null;
  }

  return free(tx, booking, releasedBy);
}

// With the kind's cap reached, a kind that allows one booking at a time
// swaps it for the new one when asked to, unless it was opened for
// walk-in. The swapped booking is deleted even once it has started.
async function swapOut(
  tx: Transaction,
  active: Held[],
  resource: BookableResource,
  replaceExisting: boolean,
  member: Member,
): Promise<{replaced: Held; told: Recipients | null}> {
  const [existing] = active;

  if (
    resource.maxActive !== 1 ||
    !replaceExisting ||
    !existing ||
    existing.released
  ) {
    throw appError('HAS_ACTIVE_BOOKING');
  }

  return {replaced: existing, told: await free(tx, existing, member)};
}

function toldOf(found: (Recipients | null)[]): Recipients[] {
  return found.filter((recipients) => recipients !== null);
}

export async function book({
  member,
  date,
  start,
  resourceId,
  replaceExisting,
  notifier,
}: {
  member: Member;
  date: string;
  start: string;
  resourceId: string;
  replaceExisting: boolean;
  notifier: Notifier;
}): Promise<CreatedBooking> {
  const resource = await bookableResource(member, resourceId);

  const {booking, told} = await db
    .transaction(async (tx) => {
      await lockApartmentBookings(tx, member.id);
      const slot = await openSlot(tx, member, resourceId, date, start);
      await assertHolder(tx, member);

      // A booking opened for walk-in still counts until it ends.
      const active = await selectHeld(tx, member.timeZone).where(
        and(stillActive(member.id), eq(resources.kindId, resource.kind)),
      );
      const swapped =
        active.length >= resource.maxActive
          ? await swapOut(tx, active, resource, replaceExisting, member)
          : null;

      const [row] = await tx
        .insert(bookings)
        .values({
          organizationId: member.organizationId,
          memberId: member.id,
          date,
          start: slot.start,
          end: slot.end,
          resourceId,
          endsAt: slotEndsAt(
            member.timeZone,
            date,
            slot.end,
            slot.endOffsetDays,
          ),
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

      // Its own queue place on the slot is done with.
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
          replacedId: swapped?.replaced.id ?? null,
        },
        told: toldOf([swapped?.told ?? null]),
      };
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw appError('SLOT_TAKEN');
      }
      throw error;
    });

  announceReleased(notifier, told);

  return booking;
}

// A queue is for a slot another apartment holds. The holding booking is
// locked until the queue place is in, so letting it go either waits and
// then finds the place, or has committed first and the slot is free.
async function assertHeldByAnother(
  tx: Transaction,
  member: Member,
  resourceId: string,
  date: string,
  start: string,
): Promise<void> {
  const [holding] = await tx
    .select({memberId: bookings.memberId})
    .from(bookings)
    .where(
      and(
        eq(bookings.resourceId, resourceId),
        eq(bookings.date, date),
        eq(bookings.start, start),
        isNull(bookings.releasedAt),
      ),
    )
    .for('share');

  if (!holding) {
    throw appError('SLOT_AVAILABLE');
  }

  if (holding.memberId === member.id) {
    throw appError('HAS_ACTIVE_BOOKING');
  }
}

export async function queue({
  member,
  date,
  start,
  resourceId,
}: {
  member: Member;
  date: string;
  start: string;
  resourceId: string;
}): Promise<Subscription> {
  const resource = await bookableResource(member, resourceId);

  const row = await db.transaction(async (tx) => {
    await lockApartmentBookings(tx, member.id);
    const slot = await openSlot(tx, member, resourceId, date, start);
    await assertHolder(tx, member);
    await assertHeldByAnother(tx, member, resourceId, date, slot.start);

    const endsAt = slotEndsAt(
      member.timeZone,
      date,
      slot.end,
      slot.endOffsetDays,
    );
    const [inserted] = await tx
      .insert(subscriptions)
      .values({
        organizationId: member.organizationId,
        memberId: member.id,
        date,
        start: slot.start,
        end: slot.end,
        resourceId,
        endsAt,
      })
      .onConflictDoUpdate({
        target: [
          subscriptions.memberId,
          subscriptions.resourceId,
          subscriptions.date,
          subscriptions.start,
        ],
        set: {endsAt},
      })
      .returning({
        id: subscriptions.id,
        date: subscriptions.date,
        start: subscriptions.start,
        end: subscriptions.end,
        endsAt: asIsoText(subscriptions.endsAt),
      });

    if (!inserted) {
      throw new Error('Insert returned no row');
    }

    return inserted;
  });

  return {
    ...row,
    available: false,
    started: false,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceKind: resource.kind,
  };
}

// A member cancelling a booking, or opening one that has started for
// walk-in.
export async function release(
  id: string,
  member: Member,
  notifier: Notifier,
): Promise<void> {
  const told = await db.transaction(async (tx) => {
    await lockApartmentBookings(tx, member.id);
    await assertHolder(tx, member);

    const [booking] = await selectHeld(tx, member.timeZone).where(
      eq(bookings.id, id),
    );

    // Already gone is done: the cancel a client retries because its answer
    // never arrived has done what was asked.
    if (!booking) {
      return [];
    }

    if (booking.memberId !== member.id) {
      throw appError('FORBIDDEN', 'Not your booking');
    }

    return toldOf([await letGo(tx, booking, member)]);
  });

  announceReleased(notifier, told);
}

// Ends everything an apartment holds, the way its member cancelling each
// would, in the caller's transaction: an admin replacing the resident or
// removing the apartment. Returns who to tell, for the caller to announce
// once that transaction has committed.
export async function releaseAll(
  tx: Transaction,
  apartment: ReleasedBy & {timeZone: string},
): Promise<Recipients[]> {
  await lockApartmentBookings(tx, apartment.id);

  const held = await selectHeld(tx, apartment.timeZone).where(
    stillActive(apartment.id),
  );
  const found: (Recipients | null)[] = [];

  for (const booking of held) {
    found.push(await letGo(tx, booking, apartment));
  }

  return toldOf(found);
}
