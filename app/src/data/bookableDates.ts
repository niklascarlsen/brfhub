const WEEKDAYS = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addOneMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + 1);

  if (next.getDate() !== day) {
    next.setDate(0);
  }

  return next;
}

export function getBookableDays(from = new Date()): Date[] {
  const start = startOfDay(from);
  const end = addOneMonth(start);
  const days: Date[] = [];

  for (
    const cursor = new Date(start);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(new Date(cursor));
  }

  return days;
}

export function getUpcomingDays(count = 7): Date[] {
  const today = startOfDay(new Date());

  return Array.from({length: count}, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
}

export function getWeekdayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('sv-SE', {month: 'short'});
}

export function formatMonthHeading(date: Date): string {
  const now = new Date();
  const includeYear = date.getFullYear() !== now.getFullYear();

  return date.toLocaleDateString('sv-SE', {
    month: 'long',
    ...(includeYear ? {year: 'numeric'} : {}),
  });
}

export function groupDaysByMonth(
  days: Date[],
): {key: string; label: string; days: Date[]}[] {
  const groups: {key: string; label: string; days: Date[]}[] = [];

  for (const day of days) {
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    const last = groups[groups.length - 1];

    if (last?.key === key) {
      last.days.push(day);
    } else {
      groups.push({key, label: formatMonthHeading(day), days: [day]});
    }
  }

  return groups;
}

export function formatLongDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}
