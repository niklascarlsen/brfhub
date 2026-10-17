import {z} from 'zod';

import {localizedInputSchema, localizedTextSchema} from '../lib/locale.js';

export const announcementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  publishedOn: z.iso.date(),
  endsOn: z.iso.date().nullable(),
  updatedAt: z.iso.datetime(),
});

// The admin edits the text in every language, so gets all of them.
export const adminAnnouncementSchema = announcementSchema.extend({
  title: localizedTextSchema,
  body: localizedTextSchema,
  status: z.enum(['scheduled', 'active', 'ended']),
});

export const adminAnnouncementsSchema = z.object({
  // Today where the organization is, so the admin's durations count from
  // the same day as the server's.
  today: z.iso.date(),
  announcements: adminAnnouncementSchema.array(),
});

// The day an announcement is published is the day it is written; the
// server sets it.
export const announcementBodySchema = z.object({
  title: localizedInputSchema(100),
  body: localizedInputSchema(2000, {multiline: true}),
  endsOn: z.iso.date().nullable(),
});

// A new announcement can also be mailed to every resident, for important
// information everyone needs to see, push or not. Only when it is
// published: a corrected typo is not mailed again.
export const newAnnouncementBodySchema = announcementBodySchema.extend({
  mail: z.boolean().default(false),
});

export const announcementParamsSchema = z.object({
  id: z.uuid(),
});

export type Announcement = z.infer<typeof announcementSchema>;
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>;
export type AdminAnnouncements = z.infer<typeof adminAnnouncementsSchema>;
export type AnnouncementBody = z.infer<typeof announcementBodySchema>;
export type NewAnnouncementBody = z.infer<typeof newAnnouncementBodySchema>;

z.globalRegistry.add(announcementSchema, {id: 'Announcement'});
z.globalRegistry.add(adminAnnouncementSchema, {id: 'AdminAnnouncement'});
z.globalRegistry.add(adminAnnouncementsSchema, {id: 'AdminAnnouncements'});
z.globalRegistry.add(announcementBodySchema, {id: 'AnnouncementBody'});
z.globalRegistry.add(newAnnouncementBodySchema, {id: 'NewAnnouncementBody'});
