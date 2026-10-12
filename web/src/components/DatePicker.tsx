import {
  getWeekdayLabel,
  groupDaysByMonth,
  toIsoDate,
} from '@booking/core/lib/dates';
import {Fragment, useMemo} from 'react';

import {useRevealSelected} from '@/hooks/useRevealSelected';
import {useRovingList} from '@/hooks/useRovingList';
import {useMessages} from '@/i18n/LocaleProvider';

type DatePickerProps = {
  days: Date[];
  selectedIso: string;
  todayIso: string;
  onSelect: (date: Date) => void;
};

const DAY = 'w-11.5';
const CIRCLE = 'size-9.5';

export function DatePicker({
  days,
  selectedIso,
  todayIso,
  onSelect,
}: DatePickerProps) {
  const t = useMessages();
  const months = groupDaysByMonth(days, todayIso, t);
  const scroller = useRevealSelected(selectedIso);

  const positions = useMemo(
    () => new Map(days.map((day, index) => [toIsoDate(day), index])),
    [days],
  );

  const roving = useRovingList({
    count: days.length,
    orientation: 'horizontal',
    resetKey: selectedIso,
    startAt: positions.get(selectedIso) ?? 0,
  });

  return (
    <div
      ref={scroller}
      role='toolbar'
      aria-label={t.calendar.chooseDay}
      aria-orientation={roving.orientation}
      onKeyDown={roving.onKeyDown}
      className='w-full shrink-0 scroll-px-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    >
      <div className='flex items-stretch gap-1 px-5 py-2.5'>
        {months.map((month, monthIndex) => (
          <Fragment key={month.key}>
            {monthIndex > 0 ? (
              <div className='flex w-4 shrink-0 flex-col items-center'>
                <div className='h-6' />
                <div className='w-px flex-1 bg-theme-line' />
              </div>
            ) : null}
            {month.days.map((day, dayIndex) => {
              const isoDate = toIsoDate(day);
              const selected = isoDate === selectedIso;
              const isToday = isoDate === todayIso;

              return (
                <button
                  type='button'
                  key={isoDate}
                  aria-pressed={selected}
                  onClick={() => onSelect(day)}
                  {...roving.itemProps(positions.get(isoDate) ?? 0)}
                  className={`group flex ${DAY} shrink-0 flex-col items-center rounded-lg active:opacity-60`}
                >
                  <span className='flex h-6 items-end'>
                    {dayIndex === 0 ? (
                      <span className='mb-1 text-[11px] font-bold tracking-[1px] text-theme-muted uppercase'>
                        {month.label}
                      </span>
                    ) : null}
                  </span>
                  <span className='text-xs font-medium text-theme-muted'>
                    {getWeekdayLabel(day, t)}
                  </span>
                  <span
                    className={`mt-1.5 flex ${CIRCLE} items-center justify-center rounded-full transition-colors ${
                      selected ? 'bg-theme-ink' : 'group-hover:bg-theme-sunk'
                    }`}
                  >
                    <span
                      className={`text-base tabular-nums ${
                        selected
                          ? 'font-semibold text-theme-surface'
                          : isToday
                            ? 'font-semibold text-theme-accent'
                            : 'font-medium text-theme-ink'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
