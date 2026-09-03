import type {BookingWindow} from '@/api/client';

const WEEKDAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isWithinBookingWindow(
  isoDate: string,
  window: BookingWindow,
): boolean {
  return isoDate >= window.from && isoDate <= window.to;
}

export function daysBetween(from: string, to: string): Date[] {
  const days: Date[] = [];

  for (
    const cursor = fromIsoDate(from);
    toIsoDate(cursor) <= to;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(new Date(cursor));
  }

  return days;
}

function formatMonthHeading(date: Date, currentYear: number): string {
  const month = MONTHS[date.getMonth()];
  const includeYear = date.getFullYear() !== currentYear;

  return includeYear ? `${month} ${date.getFullYear()}` : month;
}

export function groupDaysByMonth(
  days: Date[],
  todayIso: string,
): {key: string; label: string; days: Date[]}[] {
  const currentYear = fromIsoDate(todayIso).getFullYear();
  const groups: {key: string; label: string; days: Date[]}[] = [];

  for (const day of days) {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = groups[groups.length - 1];

    if (last?.key === key) {
      last.days.push(day);
    } else {
      groups.push({
        key,
        label: formatMonthHeading(day, currentYear),
        days: [day],
      });
    }
  }

  return groups;
}

export function getWeekdayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function formatLongDate(isoDate: string): string {
  return fromIsoDate(isoDate).toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function timeRange(start: string, end: string): string {
  return `${start}–${end}`;
}

export function formatWhen(date: string, time: string): string {
  return `${formatLongDate(date)}, ${time}`;
}
