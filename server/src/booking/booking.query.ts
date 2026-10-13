import {and, eq} from 'drizzle-orm';

import {bookings} from '../db/schema.js';
import {notExpired} from '../lib/time.js';

export function stillActive(memberId: string) {
  return and(eq(bookings.memberId, memberId), notExpired(bookings.endsAt));
}
