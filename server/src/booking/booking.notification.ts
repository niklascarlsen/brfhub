import type {Executor} from '../db/index.js';
import {
  localize,
  resolveLocale,
  type Locale,
  type LocalizedText,
} from '../lib/locale.js';
import {formatWhen} from '../lib/time.js';
import type {Member} from '../lib/user.js';
import type {
  Notification,
  Notifier,
  Recipients,
} from '../notification/notification.service.js';
import {listSubscribers} from '../subscription/subscription.query.js';

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
type ReleasedBy = Pick<Member, 'id' | 'locales'>;

// Who hears of a freed slot: its queue as the freeing transaction sees it.
// Only a slot that has not started is freed, so its queue can still book.
export async function queueOf(
  executor: Executor,
  slot: ReleasedSlot,
  releasedBy: ReleasedBy,
): Promise<Recipients> {
  const subscribers = await listSubscribers(
    slot.resourceId,
    slot.date,
    slot.start,
    executor,
  );

  return {
    memberIds: subscribers
      .map((row) => row.memberId)
      .filter((memberId) => memberId !== releasedBy.id),
    // A device keeps its language until it starts again, which can be
    // one the organization has stopped writing in since.
    build: (locale) =>
      releasedNotification(resolveLocale([locale], releasedBy.locales), slot),
  };
}

// Tells the queues found while freeing their slots, after the caller has
// answered. Called once the change has committed, so a change that rolls
// back announces nothing.
export function announceReleased(
  notifier: Notifier,
  recipients: Recipients[],
): void {
  if (recipients.every((group) => group.memberIds.length === 0)) {
    return;
  }

  notifier.later(() => notifier.notifyMembers(recipients));
}
