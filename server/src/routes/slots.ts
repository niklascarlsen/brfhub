import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {and, asc, eq, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, timeSlots} from '../db/schema.js';
import {errorSchema, sendError} from '../lib/errors.js';
import {slotEndsAt} from '../lib/time.js';
import {getUserId} from '../lib/user.js';
import {
  bookingWindowSchema,
  slotSchema,
  slotsQuerySchema,
} from '../schemas/slot.js';
import {getBookingWindow, isWithinBookingWindow} from '../services/window.js';

type SlotRow = {
  id: string;
  start: string;
  end: string;
  bookingId: string | null;
  bookingUserId: string | null;
};

function toSlot(row: SlotRow, userId: string) {
  if (!row.bookingId) {
    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: 'available' as const,
    };
  }

  if (row.bookingUserId === userId) {
    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: 'mine' as const,
      bookingId: row.bookingId,
    };
  }

  return {
    id: row.id,
    start: row.start,
    end: row.end,
    status: 'booked' as const,
  };
}

export const slotRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/slots',
    {
      schema: {
        querystring: slotsQuerySchema,
        response: {
          200: slotSchema.array(),
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const {date} = request.query;

      if (!isWithinBookingWindow(date, await getBookingWindow())) {
        return sendError(reply, 'OUTSIDE_BOOKING_WINDOW');
      }

      const rows = await db
        .select({
          id: timeSlots.id,
          start: timeSlots.start,
          end: timeSlots.end,
          bookingId: bookings.id,
          bookingUserId: bookings.userId,
        })
        .from(timeSlots)
        .leftJoin(
          bookings,
          and(eq(bookings.slotId, timeSlots.id), eq(bookings.date, date)),
        )
        .where(sql`${slotEndsAt(date, timeSlots.end)} > now()`)
        .orderBy(asc(timeSlots.start));

      return rows.map((row) => toSlot(row, userId));
    },
  );

  app.get(
    '/booking-window',
    {
      schema: {
        response: {
          200: bookingWindowSchema,
        },
      },
    },
    async () => getBookingWindow(),
  );
};
