import type {BookingWindow} from '@booking/core/api/types';
import type {Messages} from '@booking/core/i18n/catalog';
import {
  formatLongDate,
  fromIsoDate,
  isWithinBookingWindow,
} from '@booking/core/lib/dates';

import {calendarWeeks, formatMonthSpan, weekdayHeadings} from '@/desktop/weeks';
import {useRovingGrid} from '@/hooks/useRovingGrid';
import {useMessages} from '@/i18n/LocaleProvider';

export type DaySummary = {free: number; mine: boolean};

type MonthCalendarProps = {
  bookingWindow: BookingWindow;
  selected: string;
  onSelect: (isoDate: string) => void;
  // Null until the schedule has loaded. The days are still selectable.
  summaries: Map<string, DaySummary> | null;
};

function freeLabel(summary: DaySummary, t: Messages): string {
  return summary.free === 0 ? t.calendar.full : String(summary.free);
}

function ariaLabel(
  isoDate: string,
  summary: DaySummary | undefined,
  t: Messages,
) {
  const parts = [formatLongDate(isoDate, t)];

  if (summary) {
    parts.push(
      summary.free === 0
        ? t.calendar.noFreeSlots
        : t.booking.freeSlots(summary.free),
    );

    if (summary.mine) {
      parts.push(t.calendar.yourTime);
    }
  }

  return parts.join(', ');
}

export function MonthCalendar({
  bookingWindow,
  selected,
  onSelect,
  summaries,
}: MonthCalendarProps) {
  const t = useMessages();
  const weekdays = weekdayHeadings(t);
  const weeks = calendarWeeks(bookingWindow.from, bookingWindow.to);
  const inWindow = (isoDate: string) =>
    isWithinBookingWindow(isoDate, bookingWindow);

  const roving = useRovingGrid({
    rows: weeks.length,
    cols: weekdays.length,
    resetKey: bookingWindow.from,
    canFocus: (row, col) => {
      const isoDate = weeks[row]?.[col];
      return isoDate !== undefined && inWindow(isoDate);
    },
  });

  return (
    <section className='rounded-[22px] border border-theme-line bg-theme-surface p-5'>
      <div className='mb-3.5 flex items-center justify-between gap-3'>
        <h2 className='text-[17px] font-semibold tracking-tight text-theme-ink'>
          {formatMonthSpan(bookingWindow.from, bookingWindow.to, t)}
        </h2>
        <button
          type='button'
          disabled={selected === bookingWindow.today}
          onClick={() => onSelect(bookingWindow.today)}
          className='h-8 rounded-full border border-theme-edge bg-theme-surface px-3 text-xs font-semibold text-theme-ink transition-colors hover:bg-theme-sunk disabled:cursor-default disabled:opacity-35 disabled:hover:bg-theme-surface'
        >
          {t.dates.today}
        </button>
      </div>
      <div
        role='grid'
        aria-label={t.calendar.chooseDay}
        onKeyDown={roving.onKeyDown}
        className='flex flex-col gap-1.25'
      >
        <div role='row' className='grid grid-cols-7 gap-1.25'>
          {weekdays.map((weekday) => (
            <span
              key={weekday}
              role='columnheader'
              className='pb-0.5 text-center text-[11px] font-semibold text-theme-muted'
            >
              {weekday}
            </span>
          ))}
        </div>
        {weeks.map((week, row) => (
          <div key={week[0]} role='row' className='grid grid-cols-7 gap-1.25'>
            {week.map((isoDate, col) => {
              const day = fromIsoDate(isoDate).getDate();

              if (!inWindow(isoDate)) {
                return (
                  <span
                    key={isoDate}
                    role='gridcell'
                    aria-disabled='true'
                    className='flex h-14.5 items-center justify-center text-sm text-theme-edge tabular-nums'
                  >
                    {day}
                  </span>
                );
              }

              // A loaded day without slots has none left, today after the
              // last one has ended.
              const summary = summaries
                ? (summaries.get(isoDate) ?? {free: 0, mine: false})
                : undefined;
              const isSelected = isoDate === selected;
              const isToday = isoDate === bookingWindow.today;

              let surface =
                'border-theme-line bg-theme-surface text-theme-ink hover:border-theme-edge';
              if (isSelected) {
                surface = 'border-theme-ink bg-theme-ink text-theme-surface';
              } else if (summary?.mine) {
                surface = `border-theme-accent ${isToday ? 'bg-theme-mist' : 'bg-theme-surface'} text-theme-ink`;
              } else if (isToday) {
                surface =
                  'border-theme-line bg-theme-mist text-theme-ink hover:border-theme-edge';
              }

              let subTone = 'text-theme-accent';
              if (isSelected) {
                subTone = 'text-theme-edge';
              } else if (summary?.free === 0) {
                subTone = 'text-theme-faint';
              }

              return (
                <div key={isoDate} role='gridcell'>
                  <button
                    type='button'
                    {...roving.cellProps(row, col)}
                    aria-pressed={isSelected}
                    aria-label={ariaLabel(isoDate, summary, t)}
                    onClick={() => onSelect(isoDate)}
                    className={`flex h-14.5 w-full flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${surface}`}
                  >
                    <span className='text-sm font-semibold tabular-nums'>
                      {day}
                    </span>
                    <span
                      className={`h-3.5 text-[11px] font-semibold leading-3.5 tabular-nums ${subTone}`}
                    >
                      {summary ? freeLabel(summary, t) : ''}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className='mt-3 text-xs text-theme-muted'>{t.calendar.legend}</p>
    </section>
  );
}
