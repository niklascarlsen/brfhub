import {and, asc, eq, inArray, isNull, not, sql} from 'drizzle-orm';

import {isUniqueViolation} from '../db/errors.js';
import {db, type Transaction} from '../db/index.js';
import {
  bookings,
  members,
  resourceSlots,
  resources,
  subscriptions,
  user,
} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  asDateText,
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
import type {CancelledBooking} from '../resourceAdmin/resourceAdmin.dto.js';
import {
  resourceOpenOn,
  slotGone,
  slotInEffect,
} from '../resource/schedule.query.js';
import {getBookingWindow, isWithinBookingWindow} from '../slot/slot.service.js';
import type {Subscription} from '../subscription/subscription.dto.js';
import type {CreatedBooking} from './booking.dto.js';
import {announceReleased, queueOf} from './booking.notification.js';
import {stillActive} from './booking.query.js';
import {heldBookingsByKind, heldOf} from './held.js';

// How a booking begins and ends: booking a slot, queueing for one another
// apartment holds, letting one go, an apartment letting all of its go, and
// the admin cancelling the ones a change leaves without a slot. Each
// decides in one transaction under the apartment's lock, judging the clock
// after it, and tells whom it concerns once that has committed.

const BOOKING_LOCK_NAMESPACE = 881001;

// Held for the rest of the transaction by whatever changes an apartment's
// bookings or residents, so they never interleave. Taken before anything
// but the resource's lock: a booking's insert then locks the apartment's
// row, and a transaction that took the row first would deadlock with it.
export async function lockApartmentBookings(
  tx: Transaction,
  memberId: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(${BOOKING_LOCK_NAMESPACE}, hashtext(${memberId}))`,
  );
}

// Shared by whatever books or queues on the resource, and held alone by an
// admin changing its times or closing it, so a slot is never booked while
// it is taken away. Taken before the apartment's lock, in the order the
// admin's change takes them too.
async function lockResourceShared(
  tx: Transaction,
  resourceId: string,
): Promise<void> {
  await tx
    .select({id: resources.id})
    .from(resources)
    .where(eq(resources.id, resourceId))
    .for('share');
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

// Deletes a booking that has not started and finds who to tell of its
// slot. A queue place being taken on the slot holds the booking until it
// is in, so the lookup after the delete finds it.
async function free(
  tx: Transaction,
  booking: Held,
  releasedBy: ReleasedBy,
): Promise<Recipients> {
  await tx.delete(bookings).where(eq(bookings.id, booking.id));

  return queueOf(tx, booking, releasedBy);
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

// The booking the apartment names to give up for the new one goes, at the
// cap or under it, since that is what the apartment chose. One that has
// started counts until it ends, released or not, so it cannot be given
// up. One already gone leaves only the cap to check.
async function giveUp(
  tx: Transaction,
  active: Held[],
  replaceBookingId: string | undefined,
  max: number,
  member: Member,
): Promise<{replaced: Held; told: Recipients} | null> {
  const named = active.find((booking) => booking.id === replaceBookingId);

  if (named && (named.started || named.released)) {
    throw appError('HAS_ACTIVE_BOOKING');
  }

  if (named) {
    return {replaced: named, told: await free(tx, named, member)};
  }

  if (active.length >= max) {
    throw appError('HAS_ACTIVE_BOOKING');
  }

  return null;
}

function toldOf(found: (Recipients | null)[]): Recipients[] {
  return found.filter((recipients) => recipients !== null);
}

export async function book({
  member,
  date,
  start,
  resourceId,
  replaceBookingId,
  notifier,
}: {
  member: Member;
  date: string;
  start: string;
  resourceId: string;
  replaceBookingId?: string;
  notifier: Notifier;
}): Promise<CreatedBooking> {
  const resource = await bookableResource(member, resourceId);

  const {booking, told} = await db
    .transaction(async (tx) => {
      await lockResourceShared(tx, resourceId);
      await lockApartmentBookings(tx, member.id);
      const slot = await openSlot(tx, member, resourceId, date, start);
      await assertHolder(tx, member);

      // A booking opened for walk-in still counts until it ends.
      const active = await selectHeld(tx, member.timeZone).where(
        and(stillActive(member.id), eq(resources.kindId, resource.kind)),
      );
      const swapped = await giveUp(
        tx,
        active,
        replaceBookingId,
        resource.maxActive,
        member,
      );

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
    await lockResourceShared(tx, resourceId);
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
    held: heldOf(
      resource.kind,
      resource.maxActive,
      await heldBookingsByKind(member),
    ),
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
      and(eq(bookings.id, id), eq(bookings.memberId, member.id)),
    );

    // Already gone is done: the cancel a client retries because its answer
    // never arrived has done what was asked. Another apartment's booking
    // is answered the same, so an id tells nothing about anyone else's.
    if (!booking) {
      return [];
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

export type Cancelled = CancelledBooking & {memberId: string};

// The bookings on the resource that a change in the caller's transaction
// left without a slot, in the order of their day and time. One that has
// started stays: whoever is there is done with it soon.
export function orphanedBookings(
  tx: Transaction,
  resourceId: string,
  timeZone: string,
): Promise<Cancelled[]> {
  return tx
    .select({
      id: bookings.id,
      memberId: bookings.memberId,
      apartment: members.label,
      date: asDateText(bookings.date),
      start: bookings.start,
      end: bookings.end,
    })
    .from(bookings)
    .innerJoin(members, eq(members.id, bookings.memberId))
    .where(
      and(
        eq(bookings.resourceId, resourceId),
        not(slotHasStarted(timeZone, bookings.date, bookings.start)),
        slotGone(bookings),
      ),
    )
    .orderBy(asc(bookings.date), asc(bookings.start));
}

// Cancels what a change by the admin, in the caller's transaction under
// the resource's lock, left without a slot. The apartments' locks are taken
// in turn and the bookings read again under them. The admin agreed to
// cancel the ones named; any other means someone booked meanwhile, and
// then nothing changes. A queue place on a slot that is gone goes too,
// without a word: nobody lost a booking.
export async function cancelOrphaned(
  tx: Transaction,
  resourceId: string,
  timeZone: string,
  agreed: string[],
): Promise<Cancelled[]> {
  const first = await orphanedBookings(tx, resourceId, timeZone);
  const apartments = [...new Set(first.map((booking) => booking.memberId))];

  for (const memberId of apartments.sort()) {
    await lockApartmentBookings(tx, memberId);
  }

  const orphaned = await orphanedBookings(tx, resourceId, timeZone);
  const allowed = new Set(agreed);

  if (orphaned.some((booking) => !allowed.has(booking.id))) {
    throw appError('CHANGE_CANCELS_BOOKINGS');
  }

  if (orphaned.length > 0) {
    await tx.delete(bookings).where(
      inArray(
        bookings.id,
        orphaned.map((booking) => booking.id),
      ),
    );
  }

  await tx
    .delete(subscriptions)
    .where(
      and(
        eq(subscriptions.resourceId, resourceId),
        not(slotHasStarted(timeZone, subscriptions.date, subscriptions.start)),
        slotGone(subscriptions),
      ),
    );

  return orphaned;
}
