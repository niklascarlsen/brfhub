import {useRef} from 'react';

import {api, unwrap, type BookingWindow, type Resource} from '@/api/client';
import {ChevronBackIcon, ChevronForwardIcon} from '@/components/icons';
import {ResourcePicker} from '@/components/ResourcePicker';
import {SHELL} from '@/desktop/layout';
import {WeekGrid} from '@/desktop/WeekGrid';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {addDays, dayOffset, formatDayRange} from '@/desktop/weeks';

const DAYS_PER_WEEK = 7;

export type BookingProps = {
  bookingWindow: BookingWindow;
  resources: Resource[];
  resource: Resource;
  onSelectResource: (id: string) => void;
  date: string;
  onSelectDate: (isoDate: string) => void;
};

function fetchWeek(from: string, to: string, resourceId: string) {
  return unwrap(
    api.GET('/slots', {params: {query: {date: from, to, resourceId}}}),
  );
}

function weekOf(window: BookingWindow, date: string) {
  const index = Math.floor(dayOffset(window.from, date) / DAYS_PER_WEEK);
  const start = addDays(window.from, index * DAYS_PER_WEEK);
  const days = Array.from({length: DAYS_PER_WEEK}, (_, offset) =>
    addDays(start, offset),
  );
  const totalDays = dayOffset(window.from, window.to) + 1;

  // The last week can reach past the booking window. Fetch only to the edge.
  let last = days[DAYS_PER_WEEK - 1];
  if (last > window.to) {
    last = window.to;
  }

  return {
    index,
    start,
    days,
    last,
    count: Math.ceil(totalDays / DAYS_PER_WEEK),
  };
}

function WeekNavButton({
  label,
  disabled,
  onClick,
  ref,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  ref: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      ref={ref}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className='flex h-9 w-9 items-center justify-center rounded-full border border-theme-edge bg-theme-surface text-theme-ink transition-colors hover:bg-theme-sunk disabled:cursor-default disabled:opacity-35 disabled:hover:bg-theme-surface'
    >
      {children}
    </button>
  );
}

export function DesktopBooking({
  bookingWindow,
  resources,
  resource,
  onSelectResource,
  date,
  onSelectDate,
}: BookingProps) {
  const week = weekOf(bookingWindow, date);
  const prevButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  const {
    data: loaded,
    error,
    reload,
  } = useFocusLoad(
    () => fetchWeek(week.start, week.last, resource.id),
    `${week.start}:${week.last}:${resource.id}`,
  );

  const {confirmBook} = useBookingActions(reload);

  const isFirstWeek = week.index === 0;
  const isLastWeek = week.index + 1 >= week.count;

  // Stepping onto the first or last week disables the button under the
  // cursor. Hand focus to the one that stays enabled.
  function goToWeek(index: number) {
    if (index === 0) {
      nextButton.current?.focus();
    } else if (index + 1 >= week.count) {
      prevButton.current?.focus();
    }

    onSelectDate(addDays(bookingWindow.from, index * DAYS_PER_WEEK));
  }

  return (
    <>
      <div
        className={`${SHELL} flex shrink-0 items-center justify-between gap-6 pb-5 pt-7`}
      >
        <div className='flex min-w-0 items-center gap-3.5'>
          <ResourcePicker
            resources={resources}
            selectedId={resource.id}
            onSelect={onSelectResource}
            className='w-108 shrink-0'
            showTags
          />
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          <WeekNavButton
            label='Föregående vecka'
            ref={prevButton}
            disabled={isFirstWeek}
            onClick={() => goToWeek(week.index - 1)}
          >
            <ChevronBackIcon size={16} />
          </WeekNavButton>
          <h1 className='min-w-25 text-center text-[15px] font-semibold tracking-tight tabular-nums text-theme-ink'>
            {formatDayRange(week.start, week.last)}
          </h1>
          <WeekNavButton
            label='Nästa vecka'
            ref={nextButton}
            disabled={isLastWeek}
            onClick={() => goToWeek(week.index + 1)}
          >
            <ChevronForwardIcon size={16} />
          </WeekNavButton>
        </div>
      </div>
      <div className={`${SHELL} flex grow flex-col pb-8`}>
        <WeekGrid
          slots={loaded?.slots ?? null}
          days={week.days}
          resourceId={resource.id}
          todayIso={bookingWindow.today}
          lastIso={bookingWindow.to}
          error={error}
          onRetry={reload}
          onSelect={(slot) =>
            confirmBook(slot, resource, loaded?.active ?? null)
          }
        />
      </div>
    </>
  );
}
