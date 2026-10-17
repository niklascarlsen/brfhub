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
    <section className='rounded-card border border-theme-line bg-theme-surface p-5'>
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
                    className='flex h-11 items-center justify-center text-sm text-theme-edge tabular-nums'
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

              // The day alone, centred: what it holds is told by its colour
              // and border. Your time is an accent border and number, kept
              // as a ring when the day is selected; a full day is greyed.
              const isFull = summary?.free === 0;
              let fill = 'bg-theme-surface';
              if (isFull) {
                fill = 'bg-theme-track';
              } else if (isToday) {
                fill = 'bg-theme-mist';
              }

              let surface = `border-theme-line ${fill} text-theme-ink hover:border-theme-edge`;
              if (isSelected) {
                surface = `border-theme-ink bg-theme-ink text-theme-surface ${summary?.mine ? 'ring-2 ring-theme-accent ring-offset-2 ring-offset-theme-surface' : ''}`;
              } else if (summary?.mine) {
                surface = `border-2 border-theme-accent ${fill} text-theme-accent`;
              } else if (isFull) {
                surface = `border-theme-track ${fill} text-theme-faint hover:border-theme-edge`;
              }

              return (
                <div key={isoDate} role='gridcell'>
                  <button
                    type='button'
                    {...roving.cellProps(row, col)}
                    aria-pressed={isSelected}
                    aria-label={ariaLabel(isoDate, summary, t)}
                    onClick={() => onSelect(isoDate)}
                    className={`flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-colors ${surface}`}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-theme-muted'>
        <span className='flex items-center gap-1.5'>
          <span
            aria-hidden
            className='size-3.5 rounded-sm border-2 border-theme-accent'
          />
          {t.calendar.legendMine}
        </span>
        <span className='flex items-center gap-1.5'>
          <span aria-hidden className='size-3.5 rounded-sm bg-theme-track' />
          {t.calendar.legendFull}
        </span>
      </div>
    </section>
  );
}
