import {and, eq} from 'drizzle-orm';
import {bookings} from '../db/schema.js';
import {notExpired} from '../lib/time.js';

export function stillActive(userId: string) {
  return and(eq(bookings.userId, userId), notExpired(bookings.endsAt));
}
