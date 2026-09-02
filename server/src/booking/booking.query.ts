import {and, eq, gt, sql} from 'drizzle-orm';
import {bookings} from '../db/schema.js';

export function stillActive(userId: string) {
  return and(eq(bookings.userId, userId), gt(bookings.endsAt, sql`now()`));
}
