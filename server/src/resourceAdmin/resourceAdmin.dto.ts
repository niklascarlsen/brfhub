import {z} from 'zod';

import {
  localizedInputSchema,
  localizedTagsSchema,
  localizedTextSchema,
  optionalLocalizedInputSchema,
  perLocale,
} from '../lib/locale.js';
import {textSchema} from '../lib/text.js';

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
  name: localizedTextSchema,
  maxActive: z.number().int(),
});

export const adminResourceSchema = z.object({
  id: z.string(),
  name: localizedTextSchema,
  kindId: z.string(),
  tags: localizedTagsSchema,
  closesFrom: z.iso.date().nullable(),
  // What the admin said about the closing, empty while open.
  closingNote: localizedTextSchema,
  // The first day a change cancels no booking from: the day after the
  // last booking that has not started, today at the earliest.
  freeFrom: z.iso.date(),
  // The version in effect today first, then every later one.
  schedules: scheduleSchema.array(),
});

export const adminResourcesSchema = z.object({
  kinds: adminKindSchema.array(),
  resources: adminResourceSchema.array(),
  today: z.iso.date(),
});

const kindNameSchema = localizedInputSchema(40);
const maxActiveSchema = z.number().int().min(1).max(10);
const resourceNameSchema = localizedInputSchema(40);
// Up to five per language, in every language or in none.
const tagsSchema = perLocale(textSchema(30).array().max(5));

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

// What a change cancels is seen first, through the preview: the admin
// names every booking they agreed to cancel, and the change goes through
// only if it cancels none other. The reason goes to the apartments, in
// every language the organization uses or in none; a closing keeps it to
// show with the closed resource.
const cancellingSchema = z.object({
  cancels: z.uuid().array().max(2000).default([]),
  reason: optionalLocalizedInputSchema(300).default({}),
});

export const scheduleChangeSchema = z.object({
  validFrom: z.iso.date(),
  slots: slotsSchema,
});

export const closingChangeSchema = z.object({
  closesFrom: z.iso.date(),
});

export const putScheduleBodySchema = scheduleChangeSchema.extend(
  cancellingSchema.shape,
);

export const closingBodySchema = closingChangeSchema.extend(
  cancellingSchema.shape,
);

// Removing a coming change says nothing: it only names what it cancels,
// and a client may send no body when that is nothing.
export const removeScheduleBodySchema = cancellingSchema
  .pick({cancels: true})
  .nullable();

// The same changes, asked what they would cancel.
export const changePreviewBodySchema = z.discriminatedUnion('change', [
  scheduleChangeSchema.extend({change: z.literal('schedule')}),
  closingChangeSchema.extend({change: z.literal('closing')}),
  z.object({change: z.literal('removeSchedule'), validFrom: z.iso.date()}),
]);

export const cancelledBookingSchema = z.object({
  id: z.uuid(),
  apartment: z.string(),
  date: z.iso.date(),
  start: z.string(),
  end: z.string(),
});

export const changePreviewSchema = z.object({
  // In the order of their day and time.
  cancels: cancelledBookingSchema.array(),
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
export type ResourceChange = z.infer<typeof changePreviewBodySchema>;
export type Cancelling = z.infer<typeof cancellingSchema>;
export type CancelledBooking = z.infer<typeof cancelledBookingSchema>;
export type ChangePreview = z.infer<typeof changePreviewSchema>;
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
z.globalRegistry.add(removeScheduleBodySchema, {id: 'RemoveScheduleBody'});
z.globalRegistry.add(changePreviewBodySchema, {id: 'ChangePreviewBody'});
z.globalRegistry.add(cancelledBookingSchema, {id: 'CancelledBooking'});
z.globalRegistry.add(changePreviewSchema, {id: 'ChangePreview'});
z.globalRegistry.add(resourceOrderBodySchema, {id: 'ResourceOrderBody'});
