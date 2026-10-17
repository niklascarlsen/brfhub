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

// The part of the admin an event was made in, which the history can be
// narrowed to: the admin tab, or the part of the organization's page.
export const eventAreaSchema = z.enum([
  'apartments',
  'resources',
  'announcements',
  'admins',
  'organization',
]);

export const AREA_OF: Record<EventAction, EventArea> = {
  'apartment.create': 'apartments',
  'apartment.update': 'apartments',
  'apartment.newResident': 'apartments',
  'apartment.signOut': 'apartments',
  'apartment.remove': 'apartments',
  'admin.add': 'admins',
  'admin.remove': 'admins',
  'admin.resetTwoFactor': 'admins',
  'kind.create': 'resources',
  'kind.update': 'resources',
  'kind.remove': 'resources',
  'resource.create': 'resources',
  'resource.update': 'resources',
  'resource.order': 'resources',
  'resource.close': 'resources',
  'resource.reopen': 'resources',
  'resource.remove': 'resources',
  'schedule.put': 'resources',
  'schedule.remove': 'resources',
  'booking.cancel': 'resources',
  'announcement.create': 'announcements',
  'announcement.mail': 'announcements',
  'announcement.update': 'announcements',
  'announcement.remove': 'announcements',
  'organization.update': 'organization',
};

// The most a page of the history holds.
export const EVENTS_PAGE = 50;

export const listEventsQuerySchema = z.object({
  area: eventAreaSchema.optional(),
  // The page after this event, as `next` named it.
  after: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(EVENTS_PAGE).default(EVENTS_PAGE),
});

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

// A page of the history, newest first, and the event to ask for the next
// one after, while there are older ones.
export const eventPageSchema = z.object({
  events: adminEventSchema.array(),
  next: z.uuid().nullable(),
});

export type EventAction = z.infer<typeof eventActionSchema>;
export type EventArea = z.infer<typeof eventAreaSchema>;
export type AdminEvent = z.infer<typeof adminEventSchema>;
export type EventPage = z.infer<typeof eventPageSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

z.globalRegistry.add(eventActionSchema, {id: 'EventAction'});
z.globalRegistry.add(eventAreaSchema, {id: 'EventArea'});
z.globalRegistry.add(adminEventSchema, {id: 'AdminEvent'});
z.globalRegistry.add(eventPageSchema, {id: 'EventPage'});
