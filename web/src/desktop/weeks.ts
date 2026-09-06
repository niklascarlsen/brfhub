import {daysBetween, fromIsoDate, getMonthLabel, toIsoDate} from '@/lib/dates';

export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function formatDayRange(fromIso: string, toIso: string): string {
  const start = fromIsoDate(fromIso);
  const end = fromIsoDate(toIso);
  const startMonth = getMonthLabel(start);
  const endMonth = getMonthLabel(end);

  if (startMonth === endMonth) {
    return `${start.getDate()}–${end.getDate()} ${endMonth}`;
  }

  return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth}`;
}

export function dayOffset(fromIso: string, toIso: string): number {
  if (toIso < fromIso) {
    return 0;
  }

  return daysBetween(fromIso, toIso).length - 1;
}
