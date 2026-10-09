import {z} from 'zod';

export const announcementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  publishedOn: z.iso.date(),
  endsOn: z.iso.date().nullable(),
});

export const adminAnnouncementSchema = announcementSchema.extend({
  status: z.enum(['scheduled', 'active', 'ended']),
});

export const announcementBodySchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    body: z.string().trim().min(1).max(2000),
    publishedOn: z.iso.date(),
    endsOn: z.iso.date().nullable(),
  })
  .refine(
    (value) => value.endsOn === null || value.endsOn >= value.publishedOn,
    {
      message: 'endsOn must not be before publishedOn',
      path: ['endsOn'],
    },
  );

export const announcementParamsSchema = z.object({
  id: z.uuid(),
});

export type Announcement = z.infer<typeof announcementSchema>;
export type AdminAnnouncement = z.infer<typeof adminAnnouncementSchema>;
export type AnnouncementBody = z.infer<typeof announcementBodySchema>;

z.globalRegistry.add(announcementSchema, {id: 'Announcement'});
z.globalRegistry.add(adminAnnouncementSchema, {id: 'AdminAnnouncement'});
z.globalRegistry.add(announcementBodySchema, {id: 'AnnouncementBody'});
