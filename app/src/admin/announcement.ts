import {fromIsoDate, toIsoDate} from '@/lib/dates';

// How long an announcement shows, as the admin thinks of it.
export const DURATIONS = [
  {label: 'Tills vidare', days: null},
  {label: '1 vecka', days: 7},
  {label: '2 veckor', days: 14},
  {label: '1 månad', days: 30},
] as const;

export type Duration = (typeof DURATIONS)[number]['days'];

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
