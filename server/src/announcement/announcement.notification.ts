import {and, eq, isNull} from 'drizzle-orm';

import {db} from '../db/index.js';
import {members} from '../db/schema.js';
import {localize, type Locale, type LocalizedText} from '../lib/locale.js';
import type {Organization} from '../lib/user.js';
import type {
  Notification,
  Notifier,
  Recipients,
} from '../notification/notification.service.js';

export type PublishedAnnouncement = {
  // In every language, since each device is told in its own.
  title: LocalizedText;
  body: LocalizedText;
};

// A push shows a line or two: the rest is read in the app.
const BODY_LENGTH = 140;

function shortened(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > BODY_LENGTH
    ? `${line.slice(0, BODY_LENGTH - 1)}…`
    : line;
}

export function announcementNotification(
  locale: Locale,
  announcement: PublishedAnnouncement,
): Notification {
  return {
    title: localize(announcement.title, locale) ?? '',
    body: shortened(localize(announcement.body, locale) ?? ''),
    channel: 'announcements',
  };
}

// Every apartment in the organization hears of a new or changed
// announcement, in its own language, after the caller has answered.
export async function announceToApartments(
  notifier: Notifier,
  {organizationId}: Organization,
  announcement: PublishedAnnouncement,
): Promise<void> {
  const rows = await db
    .select({id: members.id})
    .from(members)
    .where(
      and(eq(members.organizationId, organizationId), isNull(members.leftAt)),
    );

  // A device keeps its language until it starts again, which can be one
  // the organization has stopped writing in since: localize then falls
  // back to a language the text is written in.
  const recipients: Recipients = {
    memberIds: rows.map((row) => row.id),
    build: (locale) => announcementNotification(locale, announcement),
  };

  if (recipients.memberIds.length > 0) {
    notifier.later(() => notifier.notifyMembers([recipients]));
  }
}
