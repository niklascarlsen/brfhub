import {sql} from 'drizzle-orm';

import type {FastifyBaseLogger} from 'fastify';

import {db} from '../db/index.js';
import {
  localize,
  resolveLocale,
  type Locale,
  type LocalizedText,
} from '../lib/locale.js';
import {formatWhen, slotHasStarted} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import {
  notifyMembers,
  type Notification,
} from '../notification/notification.service.js';
import {listSubscribers} from '../subscription/subscription.service.js';

type ReleasedSlot = {
  date: string;
  resourceId: string;
  // In every language, since each device is told in its own.
  resourceName: LocalizedText;
  start: string;
  end: string;
};

const RELEASED: Record<
  Locale,
  {title: string; body: (resource: string, when: string) => string}
> = {
  sv: {
    title: 'En tid blev ledig',
    body: (resource, when) =>
      `${resource}, ${when} är ledig – först till kvarn.`,
  },
  en: {
    title: 'A slot opened up',
    body: (resource, when) =>
      `${resource}, ${when} is free – first come, first served.`,
  },
};

export function releasedNotification(
  locale: Locale,
  slot: ReleasedSlot,
): Notification {
  const words = RELEASED[locale];

  return {
    title: words.title,
    body: words.body(
      localize(slot.resourceName, locale) ?? '',
      formatWhen(locale, slot.date, slot.start, slot.end),
    ),
    data: {
      date: slot.date,
      start: slot.start,
      resourceId: slot.resourceId,
    },
  };
}

// The apartment that let the slot go, which is not told about it.
type ReleasedBy = Pick<Member, 'id' | 'timeZone' | 'locales'>;

export async function notifySlotReleased(
  slot: ReleasedSlot,
  releasedBy: ReleasedBy,
  log: FastifyBaseLogger,
): Promise<void> {
  const started = await db
    .execute<{
      started: boolean;
    }>(
      sql`select ${slotHasStarted(releasedBy.timeZone, slot.date, slot.start)} as started`,
    )
    .then((result) => result.rows[0]?.started);

  if (started) {
    return;
  }

  const subscribers = await listSubscribers(
    slot.resourceId,
    slot.date,
    slot.start,
  );

  await notifyMembers(
    subscribers
      .map((row) => row.memberId)
      .filter((memberId) => memberId !== releasedBy.id),
    // A device keeps its language until it starts again, which can be
    // one the organization has stopped writing in since.
    (locale) =>
      releasedNotification(resolveLocale([locale], releasedBy.locales), slot),
    log,
  );
}
