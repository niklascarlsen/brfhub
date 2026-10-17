import type {Executor} from '../db/index.js';
import {
  localize,
  resolveLocale,
  type Locale,
  type LocalizedText,
} from '../lib/locale.js';
import {formatWhen} from '../lib/time.js';
import type {Member, Organization} from '../lib/user.js';
import {sendBookingsCancelled} from '../mail/mail.service.js';
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

// How the queue hears of its slot: free to book, or open for drop-in
// once the apartment holding a time under way is done with it.
export type Opening = 'free' | 'dropIn';

const RELEASED: Record<
  Opening,
  Record<
    Locale,
    {title: string; body: (resource: string, when: string) => string}
  >
> = {
  free: {
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
  },
  dropIn: {
    sv: {
      title: 'En tid är öppen för drop-in',
      body: (resource, when) => `${resource}, ${when} är öppen för drop-in nu.`,
    },
    en: {
      title: 'A slot is open for drop-in',
      body: (resource, when) => `${resource}, ${when} is open for drop-in now.`,
    },
  },
};

export function releasedNotification(
  locale: Locale,
  slot: ReleasedSlot,
  opening: Opening = 'free',
): Notification {
  const words = RELEASED[opening][locale];

  return {
    title: words.title,
    body: words.body(
      localize(slot.resourceName, locale) ?? '',
      formatWhen(locale, slot.date, slot.start, slot.end),
    ),
    channel: 'slots',
    data: {
      date: slot.date,
      start: slot.start,
      resourceId: slot.resourceId,
    },
  };
}

// The apartment that let the slot go, which is not told about it.
type ReleasedBy = Pick<Member, 'id' | 'locales'>;

// Who hears of a slot let go: its queue as the releasing transaction sees
// it. A slot that has not started is freed and can be booked; one under
// way stays booked and opens for drop-in.
export async function queueOf(
  executor: Executor,
  slot: ReleasedSlot,
  releasedBy: ReleasedBy,
  opening: Opening = 'free',
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
      releasedNotification(
        resolveLocale([locale], releasedBy.locales),
        slot,
        opening,
      ),
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

const CANCELLED: Record<
  Locale,
  {title: string; body: (resource: string, when: string) => string}
> = {
  sv: {
    title: 'En bokning har avbokats',
    body: (resource, when) => `Föreningen har avbokat ${resource}, ${when}.`,
  },
  en: {
    title: 'A booking was cancelled',
    body: (resource, when) => `The association cancelled ${resource}, ${when}.`,
  },
};

export type CancelledSlot = {
  memberId: string;
  date: string;
  start: string;
  end: string;
};

// Tells each apartment of the bookings a change by the admin cancelled,
// after the caller has answered: a push per booking to its devices, and a
// mail to its residents, both with the reason in the admin's own words. The
// push carries no slot, which may be gone, so a tap opens the booking page.
export function announceCancelled(
  notifier: Notifier,
  {organizationId, locales}: Pick<Organization, 'organizationId' | 'locales'>,
  resourceName: LocalizedText,
  cancelled: CancelledSlot[],
  reason: LocalizedText,
): void {
  if (cancelled.length === 0) {
    return;
  }

  const recipients = cancelled.map((booking) => ({
    memberIds: [booking.memberId],
    build: (deviceLocale: Locale): Notification => {
      const locale = resolveLocale([deviceLocale], locales);
      const words = CANCELLED[locale];
      const body = words.body(
        localize(resourceName, locale) ?? '',
        formatWhen(locale, booking.date, booking.start, booking.end),
      );
      const why = localize(reason, locale);

      return {
        title: words.title,
        body: why ? `${body} ${why}` : body,
        channel: 'slots',
      };
    },
  }));

  notifier.later(() => notifier.notifyMembers(recipients));

  for (const memberId of new Set(
    cancelled.map((booking) => booking.memberId),
  )) {
    notifier.later(() =>
      sendBookingsCancelled(
        organizationId,
        memberId,
        resourceName,
        cancelled.filter((booking) => booking.memberId === memberId),
        reason,
      ),
    );
  }
}
