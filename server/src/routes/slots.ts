import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {asc} from 'drizzle-orm';
import {createSelectSchema} from 'drizzle-zod';
import {z} from 'zod';

import {db} from '../db/index.js';
import {timeSlots} from '../db/schema.js';

const timeSlotSchema = createSelectSchema(timeSlots);

z.globalRegistry.add(timeSlotSchema, {id: 'TimeSlot'});

export const slotRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/slots',
    {
      schema: {
        response: {
          200: timeSlotSchema.array(),
        },
      },
    },
    async () => {
      return db
        .select({
          id: timeSlots.id,
          start: timeSlots.start,
          end: timeSlots.end,
        })
        .from(timeSlots)
        .orderBy(asc(timeSlots.start));
    },
  );
};
