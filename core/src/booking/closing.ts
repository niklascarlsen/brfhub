import type {Resource} from '../api/types';
import type {Messages} from '../i18n/catalog';
import {formatDayMonth} from '../lib/dates';

// The resource the booking page opens on: the first one open, so a closed
// one is never what the apartment sees first, else the first of all.
export function firstOpenResource<T extends Pick<Resource, 'closed'>>(
  resources: [T, ...T[]],
): T {
  return resources.find((resource) => !resource.closed) ?? resources[0];
}

// What a closed resource says in place of its slots.
export function closedNotice(
  resource: Pick<Resource, 'closingNote'>,
  t: Messages,
): {title: string; message: string} {
  return {
    title: t.booking.closedTitle,
    message: resource.closingNote || t.booking.closedMessage,
  };
}

// The rule a closing adds: closed now, or the day it closes, with what the
// admin says about it. Null for a resource that stays open.
export function closingRule(
  resource: {closed: boolean; closesFrom: string | null; closingNote: string},
  t: Messages,
): string | null {
  const closing = resource.closed
    ? t.rules.closed
    : resource.closesFrom
      ? t.rules.closes(formatDayMonth(resource.closesFrom, t))
      : null;

  if (closing === null) {
    return null;
  }

  return resource.closingNote
    ? t.rules.withNote(closing, resource.closingNote)
    : closing;
}
