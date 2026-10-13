import {asc, eq, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, resources} from '../db/schema.js';
import {asIsoText, slotHasStarted} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import type {Notifier} from '../notification/notification.service.js';
import {resourceRefFields} from '../resource/resource.service.js';
import type {Booking, CreatedBooking} from './booking.dto.js';
import {stillActive} from './booking.query.js';
import {book, release} from './lifecycle.js';

export function deleteBooking(
  id: string,
  member: Member,
  notifier: Notifier,
): Promise<void> {
  return release(id, member, notifier);
}

export function listBookings(member: Member): Promise<Booking[]> {
  return db
    .select({
      id: bookings.id,
      date: bookings.date,
      start: bookings.start,
      end: bookings.end,
      endsAt: asIsoText(bookings.endsAt),
      started: slotHasStarted(member.timeZone, bookings.date, bookings.start),
      released: sql<boolean>`${bookings.releasedAt} is not null`,
      ...resourceRefFields(member.locale),
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(stillActive(member.id))
    .orderBy(asc(bookings.date), asc(bookings.start), asc(resources.sortOrder));
}

export function createBooking(
  booking: Parameters<typeof book>[0],
): Promise<CreatedBooking> {
  return book(booking);
}
