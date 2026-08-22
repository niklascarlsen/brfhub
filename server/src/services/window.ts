import {sql} from 'drizzle-orm';
import type {z} from 'zod';

import {db} from '../db/index.js';
import {bookingWindowSql} from '../lib/time.js';
import type {bookingWindowSchema} from '../schemas/slot.js';

type BookingWindow = z.infer<typeof bookingWindowSchema>;

export async function getBookingWindow(): Promise<BookingWindow> {
  const {today, from, to} = bookingWindowSql();
  const result = await db.execute<BookingWindow>(
    sql`select ${today} as "today", ${from} as "from", ${to} as "to"`,
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Booking window query returned no row');
  }

  return row;
}

export function isWithinBookingWindow(
  date: string,
  window: BookingWindow,
): boolean {
  return date >= window.from && date <= window.to;
}
