import {and, eq, sql} from 'drizzle-orm';

import type {Executor} from '../db/index.js';
import {bookings} from '../db/schema.js';
import {notExpired} from '../lib/time.js';

const BOOKING_LOCK_NAMESPACE = 881001;

export function stillActive(memberId: string) {
  return and(eq(bookings.memberId, memberId), notExpired(bookings.endsAt));
}

// Held for the rest of the transaction by whatever changes an apartment's
// bookings, so a booking and a change of residents never interleave.
export async function lockApartmentBookings(
  executor: Executor,
  memberId: string,
): Promise<void> {
  await executor.execute(
    sql`select pg_advisory_xact_lock(${BOOKING_LOCK_NAMESPACE}, hashtext(${memberId}))`,
  );
}
