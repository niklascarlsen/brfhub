import {sql} from 'drizzle-orm';

import {db} from '../db/index.js';
import {
  localize,
  resolveLocale,
  type Locale,
  type LocalizedText,
} from '../lib/locale.js';
import {formatWhen, slotHasStarted} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import type {
  Notification,
  Notifier,
} from '../notification/notification.service.js';
import {listSubscribers} from '../subscription/subscription.service.js';

export type ReleasedSlot = {
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

async function notifySlotReleased(
  notifier: Notifier,
  slot: ReleasedSlot,
  releasedBy: ReleasedBy,
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

  await notifier.notifyMembers(
    subscribers
      .map((row) => row.memberId)
      .filter((memberId) => memberId !== releasedBy.id),
    // A device keeps its language until it starts again, which can be
    // one the organization has stopped writing in since.
    (locale) =>
      releasedNotification(resolveLocale([locale], releasedBy.locales), slot),
  );
}

// Tells the queue of each freed slot after the caller has answered. Called
// once the change has committed, so a change that rolls back announces
// nothing.
export function announceReleased(
  notifier: Notifier,
  slots: ReleasedSlot[],
  releasedBy: ReleasedBy,
): void {
  if (slots.length === 0) {
    return;
  }

  notifier.later(
    slots.map((slot) => () => notifySlotReleased(notifier, slot, releasedBy)),
  );
}
