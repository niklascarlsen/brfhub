import {z} from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const slotInputSchema = z.object({
  start: timeSchema,
  end: timeSchema,
  // 1 when the slot ends the next day, such as 20:00 to 08:00.
  endOffsetDays: z.union([z.literal(0), z.literal(1)]),
});

const slotsSchema = slotInputSchema.array().min(1).max(24);

export const scheduleSchema = z.object({
  validFrom: z.iso.date(),
  slots: slotInputSchema.array(),
});

export const adminKindSchema = z.object({
  id: z.string(),
  name: z.string(),
  maxActive: z.number().int(),
});

export const adminResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kindId: z.string(),
  tags: z.string().array(),
  closesFrom: z.iso.date().nullable(),
  // The version in effect today first, then every later one.
  schedules: scheduleSchema.array(),
});

export const adminResourcesSchema = z.object({
  kinds: adminKindSchema.array(),
  resources: adminResourceSchema.array(),
  today: z.iso.date(),
  // The first day a change that can touch bookings may start on: the day
  // after the booking window.
  earliestChange: z.iso.date(),
});

const kindNameSchema = z.string().trim().min(1).max(40);
const maxActiveSchema = z.number().int().min(1).max(10);
const resourceNameSchema = z.string().trim().min(1).max(40);
const tagsSchema = z.string().trim().min(1).max(30).array().max(5);

export const createKindBodySchema = z.object({
  name: kindNameSchema,
  maxActive: maxActiveSchema,
});

export const updateKindBodySchema = createKindBodySchema.partial();

export const createResourceBodySchema = z.object({
  name: resourceNameSchema,
  kindId: z.string().min(1),
  tags: tagsSchema,
  slots: slotsSchema,
});

export const updateResourceBodySchema = z.object({
  name: resourceNameSchema.optional(),
  kindId: z.string().min(1).optional(),
  tags: tagsSchema.optional(),
});

export const putScheduleBodySchema = z.object({
  validFrom: z.iso.date(),
  slots: slotsSchema,
});

export const closingBodySchema = z.object({
  closesFrom: z.iso.date(),
});

export const resourceOrderBodySchema = z.object({
  ids: z.string().min(1).array().min(1),
});

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const scheduleParamsSchema = z.object({
  id: z.string().min(1),
  validFrom: z.iso.date(),
});

export type SlotInput = z.infer<typeof slotInputSchema>;
export type AdminResources = z.infer<typeof adminResourcesSchema>;
export type CreateKindBody = z.infer<typeof createKindBodySchema>;
export type UpdateKindBody = z.infer<typeof updateKindBodySchema>;
export type CreateResourceBody = z.infer<typeof createResourceBodySchema>;
export type UpdateResourceBody = z.infer<typeof updateResourceBodySchema>;

z.globalRegistry.add(slotInputSchema, {id: 'ScheduleSlot'});
z.globalRegistry.add(scheduleSchema, {id: 'Schedule'});
z.globalRegistry.add(adminKindSchema, {id: 'AdminKind'});
z.globalRegistry.add(adminResourceSchema, {id: 'AdminResource'});
z.globalRegistry.add(adminResourcesSchema, {id: 'AdminResources'});
z.globalRegistry.add(createKindBodySchema, {id: 'CreateKindBody'});
z.globalRegistry.add(updateKindBodySchema, {id: 'UpdateKindBody'});
z.globalRegistry.add(createResourceBodySchema, {id: 'CreateResourceBody'});
z.globalRegistry.add(updateResourceBodySchema, {id: 'UpdateResourceBody'});
z.globalRegistry.add(putScheduleBodySchema, {id: 'PutScheduleBody'});
z.globalRegistry.add(closingBodySchema, {id: 'ClosingBody'});
z.globalRegistry.add(resourceOrderBodySchema, {id: 'ResourceOrderBody'});
