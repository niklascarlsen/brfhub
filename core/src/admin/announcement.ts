import type {Messages} from '../i18n/catalog';
import {fromIsoDate, toIsoDate} from '../lib/dates';

// How long an announcement shows, as the admin thinks of it.
export const DURATIONS = [
  {label: (t: Messages) => t.admin.announcements.untilFurther, days: null},
  {label: (t: Messages) => t.admin.announcements.oneWeek, days: 7},
  {label: (t: Messages) => t.admin.announcements.twoWeeks, days: 14},
  {label: (t: Messages) => t.admin.announcements.oneMonth, days: 30},
] as const;

export type Duration = (typeof DURATIONS)[number]['days'];

// Durations count from today, or from a first day still ahead.
export function startOf(publishedOn: string, today: string): string {
  return publishedOn > today ? publishedOn : today;
}

// The last day shown, counting the day it is published as the first.
export function endsOnAfter(publishedOn: string, days: number): string {
  const date = fromIsoDate(publishedOn);
  date.setDate(date.getDate() + days - 1);
  return toIsoDate(date);
}

export function durationOf(
  publishedOn: string,
  endsOn: string | null,
): Duration | 'custom' {
  const match = DURATIONS.find(({days}) =>
    days === null ? endsOn === null : endsOn === endsOnAfter(publishedOn, days),
  );
  return match ? match.days : 'custom';
}
