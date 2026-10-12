import type {BookingWindow} from '../api/types';
import type {Messages} from '../i18n/catalog';

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

function formatMonthHeading(
  date: Date,
  currentYear: number,
  t: Messages,
): string {
  const month = getMonthLabel(date, t);
  const includeYear = date.getFullYear() !== currentYear;

  return includeYear ? `${month} ${date.getFullYear()}` : month;
}

export function groupDaysByMonth(
  days: Date[],
  todayIso: string,
  t: Messages,
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
        label: formatMonthHeading(day, currentYear, t),
        days: [day],
      });
    }
  }

  return groups;
}

export function getWeekdayLabel(date: Date, t: Messages): string {
  return t.dates.weekdays[date.getDay()];
}

export function getMonthLabel(date: Date, t: Messages): string {
  return t.dates.months[date.getMonth()];
}

export function formatLongDate(isoDate: string, t: Messages): string {
  return fromIsoDate(isoDate).toLocaleDateString(t.dates.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// "9 november", for a day the reader already knows is near.
export function formatDayMonth(isoDate: string, t: Messages): string {
  return fromIsoDate(isoDate).toLocaleDateString(t.dates.locale, {
    day: 'numeric',
    month: 'long',
  });
}

export function timeRange(start: string, end: string): string {
  return `${start}–${end}`;
}

// Word joiners around the dash keep a range on one line, so a list of
// ranges only wraps between them.
export function unbrokenRange(start: string, end: string): string {
  return timeRange(start, end).replace('–', '\u2060–\u2060');
}

export function formatWhen(date: string, time: string, t: Messages): string {
  return `${formatLongDate(date, t)}, ${time}`;
}
