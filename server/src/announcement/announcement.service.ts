import {and, desc, eq, gte, isNull, lte, or, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {announcements} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {asDateText, todaySql} from '../lib/time.js';
import type {
  AdminAnnouncement,
  Announcement,
  AnnouncementBody,
} from './announcement.dto.js';

const fields = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  publishedOn: asDateText(announcements.publishedOn),
  endsOn: sql<string | null>`to_char(${announcements.endsOn}, 'YYYY-MM-DD')`,
};

const newestFirst = [
  desc(announcements.publishedOn),
  desc(announcements.createdAt),
] as const;

// What an apartment sees today: published and not yet ended.
export function listActiveAnnouncements(
  organizationId: string,
): Promise<Announcement[]> {
  const today = todaySql();

  return db
    .select(fields)
    .from(announcements)
    .where(
      and(
        eq(announcements.organizationId, organizationId),
        lte(announcements.publishedOn, today),
        or(isNull(announcements.endsOn), gte(announcements.endsOn, today)),
      ),
    )
    .orderBy(...newestFirst);
}

export function listAdminAnnouncements(
  organizationId: string,
): Promise<AdminAnnouncement[]> {
  const today = todaySql();

  return db
    .select({
      ...fields,
      status: sql<AdminAnnouncement['status']>`case
        when ${announcements.publishedOn} > ${today} then 'scheduled'
        when ${announcements.endsOn} < ${today} then 'ended'
        else 'active' end`,
    })
    .from(announcements)
    .where(eq(announcements.organizationId, organizationId))
    .orderBy(...newestFirst);
}

export async function createAnnouncement(
  organizationId: string,
  body: AnnouncementBody,
): Promise<string> {
  const [created] = await db
    .insert(announcements)
    .values({organizationId, ...body})
    .returning({id: announcements.id});

  if (!created) {
    throw new Error('Insert returned no announcement');
  }

  return created.id;
}

function ownAnnouncement(organizationId: string, id: string) {
  return and(
    eq(announcements.organizationId, organizationId),
    eq(announcements.id, id),
  );
}

export async function updateAnnouncement(
  organizationId: string,
  id: string,
  body: AnnouncementBody,
): Promise<void> {
  const updated = await db
    .update(announcements)
    .set(body)
    .where(ownAnnouncement(organizationId, id))
    .returning({id: announcements.id});

  if (updated.length === 0) {
    throw appError('NOT_FOUND', 'Unknown announcement');
  }
}

export async function deleteAnnouncement(
  organizationId: string,
  id: string,
): Promise<void> {
  const removed = await db
    .delete(announcements)
    .where(ownAnnouncement(organizationId, id))
    .returning({id: announcements.id});

  if (removed.length === 0) {
    throw appError('NOT_FOUND', 'Unknown announcement');
  }
}
