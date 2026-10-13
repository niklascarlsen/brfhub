import {asc, eq, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, resourceKinds, resources} from '../db/schema.js';
import {localized} from '../lib/locale.js';
import {slotHasStarted} from '../lib/time.js';
import type {Member, Organization} from '../lib/user.js';
import type {Held, HeldBooking} from './booking.dto.js';
import {stillActive} from './booking.query.js';

// The apartment's bookings that count against a cap, by kind: a released
// one counts until it ends.
export async function heldBookingsByKind(
  member: Member,
): Promise<Map<string, HeldBooking[]>> {
  const rows = await db
    .select({
      kind: resources.kindId,
      id: bookings.id,
      date: bookings.date,
      start: bookings.start,
      end: bookings.end,
      resourceName: localized(resources.name, member.locale),
      started: slotHasStarted(member.timeZone, bookings.date, bookings.start),
      released: sql<boolean>`${bookings.releasedAt} is not null`,
    })
    .from(bookings)
    .innerJoin(resources, eq(bookings.resourceId, resources.id))
    .where(stillActive(member.id))
    .orderBy(asc(bookings.date), asc(bookings.start));

  const byKind = new Map<string, HeldBooking[]>();

  for (const {kind, ...booking} of rows) {
    byKind.set(kind, [...(byKind.get(kind) ?? []), booking]);
  }

  return byKind;
}

// How many bookings of each kind an apartment may hold at once.
export async function capsByKind({
  organizationId,
}: Organization): Promise<Map<string, number>> {
  const rows = await db
    .select({kind: resourceKinds.id, max: resourceKinds.maxActive})
    .from(resourceKinds)
    .where(eq(resourceKinds.organizationId, organizationId));

  return new Map(rows.map((row) => [row.kind, row.max]));
}

export function heldOf(
  kind: string,
  max: number,
  byKind: Map<string, HeldBooking[]>,
): Held {
  return {max, bookings: byKind.get(kind) ?? []};
}
