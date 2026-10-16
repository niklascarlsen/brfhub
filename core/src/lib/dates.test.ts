import {describe, expect, test} from 'vitest';

import type {BookingWindow, Slot} from '../api/types';
import {en} from '../i18n/en';
import {sv} from '../i18n/sv';
import {
  daysBetween,
  formatDayHeading,
  formatDayMonth,
  formatLongDate,
  formatWhen,
  fromIsoDate,
  getWeekdayLabel,
  groupDaysByMonth,
  isOvernight,
  isWithinBookingWindow,
  shortTimeRange,
  timeRange,
  toIsoDate,
  unbrokenRange,
} from './dates';

// Shaped by the generated types, so a server schema change breaks the build
// here too. The dates themselves are arbitrary: these are pure functions.
const WINDOW: BookingWindow = {
  today: '2026-09-03',
  from: '2026-09-03',
  to: '2026-10-03',
};
const SLOT: Pick<Slot, 'start' | 'end'> = {start: '07:00', end: '10:00'};

// The server sends today plus one Postgres month, and Postgres clamps that to
// the end of a short month. The window is 29 to 32 days wide, never a fixed 31.
const WINDOWS: (BookingWindow & {length: number})[] = [
  {today: '2026-01-31', from: '2026-01-31', to: '2026-02-28', length: 29},
  {today: '2028-01-31', from: '2028-01-31', to: '2028-02-29', length: 30},
  {...WINDOW, length: 31},
  {today: '2026-12-15', from: '2026-12-15', to: '2027-01-15', length: 32},
];

// Both zones the suite runs in move their clocks in 2026: New York on 8 March
// and 1 November, Stockholm on 29 March and 25 October.
const CLOCK_CHANGES: [string, [string, string, string]][] = [
  ['New York springs forward', ['2026-03-07', '2026-03-08', '2026-03-09']],
  ['Stockholm springs forward', ['2026-03-28', '2026-03-29', '2026-03-30']],
  ['Stockholm falls back', ['2026-10-24', '2026-10-25', '2026-10-26']],
  ['New York falls back', ['2026-10-31', '2026-11-01', '2026-11-02']],
];

function isoDaysIn(from: string, to: string) {
  return daysBetween(from, to).map(toIsoDate);
}

describe.each(WINDOWS)('a $length day window, $from to $to', (window) => {
  test('runs end to end with no gap and no repeat', () => {
    const days = isoDaysIn(window.from, window.to);

    expect(days).toHaveLength(window.length);
    expect(days[0]).toBe(window.from);
    expect(days.at(-1)).toBe(window.to);
    expect(new Set(days).size).toBe(days.length);
    expect(days).toEqual([...days].sort());
  });

  test('every day reaches the picker inside exactly one month group', () => {
    const groups = groupDaysByMonth(
      daysBetween(window.from, window.to),
      window.today,
      sv,
    );

    expect(groups.flatMap((group) => group.days).map(toIsoDate)).toEqual(
      isoDaysIn(window.from, window.to),
    );
  });
});

describe('daysBetween', () => {
  test.each(CLOCK_CHANGES)('keeps one day per step when %s', (_, expected) => {
    expect(isoDaysIn(expected[0], expected[2])).toEqual(expected);
  });

  test('keeps the leap day', () => {
    expect(isoDaysIn('2028-02-28', '2028-03-01')).toEqual([
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  test('gives a single day when the window is one day wide', () => {
    expect(isoDaysIn(WINDOW.today, WINDOW.today)).toEqual([WINDOW.today]);
  });

  test('gives nothing when the window ends before it starts', () => {
    expect(isoDaysIn('2026-09-04', '2026-09-03')).toEqual([]);
  });
});

describe('toIsoDate and fromIsoDate', () => {
  test('round-trip every day the picker can show', () => {
    for (const day of isoDaysIn(WINDOW.from, WINDOW.to)) {
      expect(toIsoDate(fromIsoDate(day))).toBe(day);
    }
  });

  test.each(CLOCK_CHANGES)('round-trip the day %s', (_, [, day]) => {
    expect(toIsoDate(fromIsoDate(day))).toBe(day);
  });

  test('pad a single digit month and day', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(fromIsoDate('2026-01-05'))).toBe('2026-01-05');
  });

  test('an ISO date becomes local midnight, not UTC midnight', () => {
    const day = fromIsoDate(WINDOW.today);

    expect(day.getHours()).toBe(0);
    expect(day.getMinutes()).toBe(0);
    expect(day.getDate()).toBe(3);
  });
});

describe('groupDaysByMonth', () => {
  test('splits the window where the month changes', () => {
    const groups = groupDaysByMonth(
      daysBetween(WINDOW.from, WINDOW.to),
      WINDOW.today,
      sv,
    );

    expect(groups.map((group) => group.label)).toEqual(['sep', 'okt']);
    expect(groups.map((group) => group.days.length)).toEqual([28, 3]);
  });

  test('names the year the window crosses into, not the one it starts in', () => {
    const groups = groupDaysByMonth(
      daysBetween('2026-12-15', '2027-01-15'),
      '2026-12-15',
      sv,
    );

    expect(groups.map((group) => group.label)).toEqual(['dec', 'jan 2027']);
  });

  test('takes the year from the server, not from the device', () => {
    // Always a year the device is not in, so a device clock cannot pass this.
    const serverYear = new Date().getFullYear() + 4;

    const groups = groupDaysByMonth(
      daysBetween(`${serverYear}-12-30`, `${serverYear + 1}-01-02`),
      `${serverYear}-12-20`,
      sv,
    );

    expect(groups.map((group) => group.label)).toEqual([
      'dec',
      `jan ${serverYear + 1}`,
    ]);
  });

  test('has nothing to group when there are no days', () => {
    expect(groupDaysByMonth([], WINDOW.today, sv)).toEqual([]);
  });
});

describe('isWithinBookingWindow', () => {
  test('takes both ends of the window, the way the server does', () => {
    expect(isWithinBookingWindow(WINDOW.from, WINDOW)).toBe(true);
    expect(isWithinBookingWindow(WINDOW.to, WINDOW)).toBe(true);
  });

  test('turns away the day before and the day after', () => {
    expect(isWithinBookingWindow('2026-09-02', WINDOW)).toBe(false);
    expect(isWithinBookingWindow('2026-10-04', WINDOW)).toBe(false);
  });

  test('holds for every day the picker offers, and no other', () => {
    const offered = new Set(isoDaysIn(WINDOW.from, WINDOW.to));

    for (const day of isoDaysIn('2026-08-01', '2026-11-01')) {
      expect(isWithinBookingWindow(day, WINDOW)).toBe(offered.has(day));
    }
  });

  test('compares dates as text, so a year change cannot fool it', () => {
    const window: BookingWindow = {
      today: '2026-12-15',
      from: '2026-12-15',
      to: '2027-01-15',
    };

    expect(isWithinBookingWindow('2027-01-01', window)).toBe(true);
    expect(isWithinBookingWindow('2026-12-14', window)).toBe(false);
    expect(isWithinBookingWindow('2027-01-16', window)).toBe(false);
  });
});

describe('labels', () => {
  test('every weekday maps to its Swedish short form', () => {
    const week = isoDaysIn('2026-08-31', '2026-09-06');

    expect(week.map((day) => getWeekdayLabel(fromIsoDate(day), sv))).toEqual([
      'mån',
      'tis',
      'ons',
      'tor',
      'fre',
      'lör',
      'sön',
    ]);
  });

  test('a slot keeps the times the server sent, joined by an en dash', () => {
    expect(timeRange(SLOT.start, SLOT.end)).toBe('07:00–10:00');
  });

  test('an unbroken range only differs by invisible word joiners', () => {
    const range = unbrokenRange(SLOT.start, SLOT.end);
    expect(range).toBe('07:00\u2060–\u206010:00');
    expect(range.replace(/\u2060/g, '')).toBe(timeRange(SLOT.start, SLOT.end));
  });

  test('a short range drops the minutes only when both ends are whole hours', () => {
    expect(shortTimeRange('07:00', '10:00')).toBe('07–10');
    expect(shortTimeRange('07:30', '10:00')).toBe('07:30–10:00');
    expect(shortTimeRange('07:00', '10:45')).toBe('07:00–10:45');
  });

  test('a slot is overnight when it ends at or before its start', () => {
    expect(isOvernight('20:00', '08:00')).toBe(true);
    expect(isOvernight('20:00', '00:00')).toBe(true);
    expect(isOvernight('07:00', '10:00')).toBe(false);
  });

  // These two delegate to toLocaleDateString, so they assert Node's ICU. The
  // app runs on Hermes, whose ICU is its own: a wording difference on device
  // will not show up here, only a change to the locale or options we pass.
  test('a date is written in Swedish, weekday first', () => {
    expect(formatLongDate(WINDOW.today, sv)).toBe('torsdag 3 september');
    expect(formatDayMonth(WINDOW.today, sv)).toBe('3 september');
    expect(formatWhen(WINDOW.today, timeRange(SLOT.start, SLOT.end), sv)).toBe(
      'torsdag 3 september, 07:00–10:00',
    );
  });

  test('a date is written in English, weekday first', () => {
    expect(formatLongDate(WINDOW.today, en)).toBe('Thursday 3 September');
    expect(formatDayMonth(WINDOW.today, en)).toBe('3 September');
    expect(formatWhen(WINDOW.today, timeRange(SLOT.start, SLOT.end), en)).toBe(
      'Thursday 3 September, 07:00–10:00',
    );
  });

  test('a date on its own starts with a capital, in a sentence it does not', () => {
    expect(formatDayHeading(WINDOW.today, sv)).toBe('Torsdag 3 september');
    expect(formatDayHeading(WINDOW.today, en)).toBe('Thursday 3 September');
  });

  test('a long date shows the server day number, never the day before', () => {
    for (const day of isoDaysIn(WINDOW.from, WINDOW.to)) {
      const dayOfMonth = fromIsoDate(day).getDate();

      expect(formatLongDate(day, sv)).toMatch(
        new RegExp(`\\b${dayOfMonth}\\b`),
      );
    }
  });
});
