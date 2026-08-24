import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {and, asc, eq, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {bookings, subscriptions, timeSlots} from '../db/schema.js';
import {errorSchema, sendError} from '../lib/errors.js';
import {slotEndsAt, slotHasStarted} from '../lib/time.js';
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
  started: boolean;
  bookingId: string | null;
  bookingUserId: string | null;
  subscriptionId: string | null;
};

function toSlot(row: SlotRow, userId: string) {
  if (!row.bookingId) {
    return {
      id: row.id,
      start: row.start,
      end: row.end,
      status: row.started ? ('walkin' as const) : ('available' as const),
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
    subscriptionId: row.subscriptionId,
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
          started: slotHasStarted(date, timeSlots.start),
          bookingId: bookings.id,
          bookingUserId: bookings.userId,
          subscriptionId: subscriptions.id,
        })
        .from(timeSlots)
        .leftJoin(
          bookings,
          and(eq(bookings.slotId, timeSlots.id), eq(bookings.date, date)),
        )
        .leftJoin(
          subscriptions,
          and(
            eq(subscriptions.slotId, timeSlots.id),
            eq(subscriptions.date, date),
            eq(subscriptions.userId, userId),
          ),
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
