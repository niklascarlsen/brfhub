import {z} from 'zod';

export const announcementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  publishedOn: z.iso.date(),
  endsOn: z.iso.date().nullable(),
  updatedAt: z.iso.datetime(),
});

export const adminAnnouncementSchema = announcementSchema.extend({
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
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(2000),
  endsOn: z.iso.date().nullable(),
});

export const announcementParamsSchema = z.object({
  id: z.uuid(),
});

export type Announcement = z.infer<typeof announcementSchema>;
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>;
export type AdminAnnouncements = z.infer<typeof adminAnnouncementsSchema>;
export type AnnouncementBody = z.infer<typeof announcementBodySchema>;

z.globalRegistry.add(announcementSchema, {id: 'Announcement'});
z.globalRegistry.add(adminAnnouncementSchema, {id: 'AdminAnnouncement'});
z.globalRegistry.add(adminAnnouncementsSchema, {id: 'AdminAnnouncements'});
z.globalRegistry.add(announcementBodySchema, {id: 'AnnouncementBody'});
