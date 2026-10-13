import {and, desc, eq, gte, isNull, lte, or, sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {announcements} from '../db/schema.js';
import {appError} from '../lib/errors.js';
import {
  assertTranslated,
  localized,
  type Locale,
  type LocalizedText,
} from '../lib/locale.js';
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

// What an apartment reads, in its own language.
function textIn(locale: Locale) {
  return {
    title: localized(announcements.title, locale),
    body: localized(announcements.body, locale),
  };
}

// Written in every language the organization uses.
function translated(body: AnnouncementBody, locales: Locale[]) {
  return {
    ...body,
    title: assertTranslated(body.title, locales),
    body: assertTranslated(body.body, locales),
  };
}

const newestFirst = [
  desc(announcements.publishedOn),
  desc(announcements.createdAt),
] as const;

// What an apartment sees today: published and not yet ended.
export function listActiveAnnouncements({
  organizationId,
  timeZone,
  locale,
}: Organization): Promise<Announcement[]> {
  const today = todaySql(timeZone);

  return db
    .select({...fields, ...textIn(locale)})
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
        title: announcements.title,
        body: announcements.body,
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
  {organizationId, timeZone, locales}: Organization,
  body: AnnouncementBody,
): Promise<string> {
  const text = translated(body, locales);
  const publishedOn = await today(timeZone);
  assertEndsOn(body.endsOn, publishedOn);

  const [created] = await db
    .insert(announcements)
    .values({organizationId, ...text, publishedOn})
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
  {organizationId, timeZone, locales}: Organization,
  id: string,
  body: AnnouncementBody,
): Promise<void> {
  const text = translated(body, locales);
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
    .set({...text, updatedAt: sql`now()`})
    .where(ownAnnouncement(organizationId, id))
    .returning({id: announcements.id});

  if (updated.length === 0) {
    throw appError('NOT_FOUND', 'Unknown announcement');
  }
}

// Answers with the title, for the event log.
export async function deleteAnnouncement(
  organizationId: string,
  id: string,
): Promise<LocalizedText> {
  const [removed] = await db
    .delete(announcements)
    .where(ownAnnouncement(organizationId, id))
    .returning({title: announcements.title});

  if (!removed) {
    throw appError('NOT_FOUND', 'Unknown announcement');
  }

  return removed.title;
}
