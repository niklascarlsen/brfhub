import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {asc, eq} from 'drizzle-orm';
import {createSelectSchema} from 'drizzle-zod';
import type {FastifyRequest} from 'fastify';
import {z} from 'zod';

import {db} from '../db/index.js';
import {bookings, timeSlots} from '../db/schema.js';
import {errorSchema, httpError, isUniqueViolation} from '../lib/errors.js';

const bookingSchema = createSelectSchema(bookings, {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
});

const createBookingBodySchema = bookingSchema.pick({
  date: true,
  slotId: true,
});

const bookingIdParamsSchema = bookingSchema.pick({id: true});

z.globalRegistry.add(bookingSchema, {id: 'Booking'});
z.globalRegistry.add(createBookingBodySchema, {id: 'CreateBookingBody'});

function getUserId(request: FastifyRequest): string {
  const header = request.headers['x-user-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return 'me';
}

export const bookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/bookings',
    {
      schema: {
        response: {
          200: bookingSchema.array(),
        },
      },
    },
    async () => {
      const rows = await db
        .select({
          id: bookings.id,
          date: bookings.date,
          slotId: bookings.slotId,
          userId: bookings.userId,
        })
        .from(bookings)
        .orderBy(asc(bookings.date), asc(bookings.slotId));

      return rows;
    },
  );

  app.post(
    '/bookings',
    {
      schema: {
        body: createBookingBodySchema,
        response: {
          201: bookingSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const {date, slotId} = request.body;

      const slot = await db
        .select({id: timeSlots.id})
        .from(timeSlots)
        .where(eq(timeSlots.id, slotId))
        .then((rows) => rows[0]);

      if (!slot) {
        return reply
          .code(404)
          .send(httpError(404, 'Not Found', 'Unknown time slot'));
      }

      try {
        const [row] = await db
          .insert(bookings)
          .values({date, slotId, userId})
          .returning({
            id: bookings.id,
            date: bookings.date,
            slotId: bookings.slotId,
            userId: bookings.userId,
          });

        if (!row) {
          throw new Error('Insert returned no row');
        }

        return reply.code(201).send(row);
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply
            .code(409)
            .send(httpError(409, 'Conflict', 'Slot already booked'));
        }
        throw error;
      }
    },
  );

  app.delete(
    '/bookings/:id',
    {
      schema: {
        params: bookingIdParamsSchema,
        response: {
          204: z.undefined(),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const {id} = request.params;

      const existing = await db
        .select({
          id: bookings.id,
          userId: bookings.userId,
        })
        .from(bookings)
        .where(eq(bookings.id, id))
        .then((rows) => rows[0]);

      if (!existing) {
        return reply
          .code(404)
          .send(httpError(404, 'Not Found', 'Booking not found'));
      }

      if (existing.userId !== userId) {
        return reply
          .code(403)
          .send(httpError(403, 'Forbidden', 'Not your booking'));
      }

      await db.delete(bookings).where(eq(bookings.id, id));
      return reply.code(204).send();
    },
  );
};
