import {and, desc, eq, gte, isNull, lte, or, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {announcements} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {asDateText, todaySql} from '../lib/time.js';
import type {Organization} from '../lib/user.js';
import type {
  AdminAnnouncement,
  AdminAnnouncements,
  Announcement,
  AnnouncementBody,
} from './announcement.dto.js';

const fields = {
  id: announcements.id,
  title: announcements.title,
  body: announcements.body,
  publishedOn: asDateText(announcements.publishedOn),
  endsOn: sql<string | null>`to_char(${announcements.endsOn}, 'YYYY-MM-DD')`,
  // To the millisecond, so an edit right after publishing still differs.
  updatedAt: sql<string>`to_char(${announcements.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
};

async function today(timeZone: string): Promise<string> {
  const {rows} = await db.execute<{today: string}>(
    sql`select ${asDateText(todaySql(timeZone))} as today`,
  );
  const row = rows[0];

  if (!row) {
    throw new Error('No date from the database');
  }

  return row.today;
}

function assertEndsOn(endsOn: string | null, from: string) {
  if (endsOn !== null && endsOn < from) {
    throw appError(
      'ENDS_IN_PAST',
      `The announcement can end on ${from} at the earliest`,
    );
  }
}

const newestFirst = [
  desc(announcements.publishedOn),
  desc(announcements.createdAt),
] as const;

// What an apartment sees today: published and not yet ended.
export function listActiveAnnouncements({
  organizationId,
  timeZone,
}: Organization): Promise<Announcement[]> {
  const today = todaySql(timeZone);

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

export async function listAdminAnnouncements({
  organizationId,
  timeZone,
}: Organization): Promise<AdminAnnouncements> {
  const day = todaySql(timeZone);

  const [current, rows] = await Promise.all([
    today(timeZone),
    db
      .select({
        ...fields,
        status: sql<AdminAnnouncement['status']>`case
          when ${announcements.publishedOn} > ${day} then 'scheduled'
          when ${announcements.endsOn} < ${day} then 'ended'
          else 'active' end`,
      })
      .from(announcements)
      .where(eq(announcements.organizationId, organizationId))
      .orderBy(...newestFirst),
  ]);

  return {today: current, announcements: rows};
}

export async function createAnnouncement(
  {organizationId, timeZone}: Organization,
  body: AnnouncementBody,
): Promise<string> {
  const publishedOn = await today(timeZone);
  assertEndsOn(body.endsOn, publishedOn);

  const [created] = await db
    .insert(announcements)
    .values({organizationId, ...body, publishedOn})
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

// A new end may not lie in the past, but an ended announcement can still
// have its text corrected.
export async function updateAnnouncement(
  {organizationId, timeZone}: Organization,
  id: string,
  body: AnnouncementBody,
): Promise<void> {
  const [existing] = await db
    .select({
      publishedOn: asDateText(announcements.publishedOn),
      endsOn: sql<
        string | null
      >`to_char(${announcements.endsOn}, 'YYYY-MM-DD')`,
    })
    .from(announcements)
    .where(ownAnnouncement(organizationId, id));

  if (!existing) {
    throw appError('NOT_FOUND', 'Unknown announcement');
  }

  if (body.endsOn !== existing.endsOn) {
    const current = await today(timeZone);
    assertEndsOn(
      body.endsOn,
      existing.publishedOn > current ? existing.publishedOn : current,
    );
  }

  const updated = await db
    .update(announcements)
    .set({...body, updatedAt: sql`now()`})
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
