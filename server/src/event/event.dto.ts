import {z} from 'zod';

// What an admin can do that the other admins should be able to see.
export const eventActionSchema = z.enum([
  'apartment.create',
  'apartment.update',
  'apartment.newResident',
  'apartment.signOut',
  'apartment.remove',
  'admin.add',
  'admin.remove',
  'admin.resetTwoFactor',
  'kind.create',
  'kind.update',
  'kind.remove',
  'resource.create',
  'resource.update',
  'resource.order',
  'resource.close',
  'resource.reopen',
  'resource.remove',
  'schedule.put',
  'schedule.remove',
  'booking.cancel',
  'announcement.create',
  'announcement.mail',
  'announcement.update',
  'announcement.remove',
  'organization.update',
]);

export const adminEventSchema = z.object({
  id: z.uuid(),
  // The admin's address at the time.
  actor: z.string(),
  // The admin's name, while they are still one.
  actorName: z.string().nullable(),
  action: eventActionSchema,
  // What it was done to, as the actor saw it: a number, a name.
  subject: z.string(),
  at: z.iso.datetime(),
});

export type EventAction = z.infer<typeof eventActionSchema>;
export type AdminEvent = z.infer<typeof adminEventSchema>;

z.globalRegistry.add(eventActionSchema, {id: 'EventAction'});
z.globalRegistry.add(adminEventSchema, {id: 'AdminEvent'});
