import {formatLongDate, fromIsoDate, toIsoDate} from '@/lib/dates';

const DAYS_PER_WEEK = 7;

export function addDays(isoDate: string, days: number): string {
  const date = fromIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// Monday is 0.
function weekdayIndex(isoDate: string): number {
  return (fromIsoDate(isoDate).getDay() + 6) % DAYS_PER_WEEK;
}

// The whole weeks, Monday to Sunday, that cover from..to.
export function calendarWeeks(from: string, to: string): string[][] {
  const weeks: string[][] = [];

  for (
    let monday = addDays(from, -weekdayIndex(from));
    monday <= to;
    monday = addDays(monday, DAYS_PER_WEEK)
  ) {
    weeks.push(
      Array.from({length: DAYS_PER_WEEK}, (_, offset) =>
        addDays(monday, offset),
      ),
    );
  }

  return weeks;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatHeadingDate(isoDate: string): string {
  return capitalize(formatLongDate(isoDate));
}

// "Oktober – november", or a single month when the range stays in one.
export function formatMonthSpan(from: string, to: string): string {
  const month = (isoDate: string) =>
    fromIsoDate(isoDate).toLocaleDateString('sv-SE', {month: 'long'});
  const first = month(from);
  const last = month(to);

  return capitalize(first === last ? first : `${first} – ${last}`);
}

export function relativeDay(isoDate: string, todayIso: string): string | null {
  if (isoDate === todayIso) {
    return 'Idag';
  }

  if (isoDate === addDays(todayIso, 1)) {
    return 'Imorgon';
  }

  return null;
}
