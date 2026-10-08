import {
  api,
  unwrap,
  type Booking,
  type BookingWindow,
  type Resource,
} from '@/api/client';
import {MyTimesList} from '@/components/MyTimes';
import {useConfig} from '@/config';
import {DayPanel, type ResourceDay} from '@/desktop/DayPanel';
import {SHELL} from '@/desktop/layout';
import {MonthCalendar, type DaySummary} from '@/desktop/MonthCalendar';
import {PageHeader} from '@/desktop/PageHeader';
import {formatHeadingDate, relativeDay} from '@/desktop/weeks';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {fromIsoDate, getWeekdayLabel, timeRange} from '@/lib/dates';

export type BookingProps = {
  bookingWindow: BookingWindow;
  resources: Resource[];
  resource: Resource;
  onSelectResource: (id: string) => void;
  date: string;
  onSelectDate: (isoDate: string) => void;
};

// The whole booking window for every resource, and the apartment's own
// times, in one go. Picking a day then needs no request, and a booking
// reloads both so the calendar and the list never disagree.
async function fetchOverview(bookingWindow: BookingWindow) {
  const [schedule, bookings, subscriptions] = await Promise.all([
    unwrap(
      api.GET('/schedule', {
        params: {query: {from: bookingWindow.from, to: bookingWindow.to}},
      }),
    ),
    unwrap(api.GET('/bookings')),
    unwrap(api.GET('/subscriptions')),
  ]);

  return {schedule, times: {bookings, subscriptions}};
}

type Overview = Awaited<ReturnType<typeof fetchOverview>>;

function summarize(schedule: Overview['schedule']): Map<string, DaySummary> {
  const summaries = new Map<string, DaySummary>();

  for (const entry of schedule) {
    for (const slot of entry.slots) {
      const summary = summaries.get(slot.date) ?? {free: 0, mine: false};

      if (slot.status === 'available') {
        summary.free += 1;
      } else if (slot.status === 'mine') {
        summary.mine = true;
      }

      summaries.set(slot.date, summary);
    }
  }

  return summaries;
}

function NextBooking({
  booking,
  todayIso,
  onSelectDate,
}: {
  booking: Booking;
  todayIso: string;
  onSelectDate: (isoDate: string) => void;
}) {
  const day = fromIsoDate(booking.date);
  const when =
    relativeDay(booking.date, todayIso) ?? formatHeadingDate(booking.date);

  return (
    <button
      type='button'
      onClick={() => onSelectDate(booking.date)}
      className='flex items-center gap-3.5 rounded-2xl bg-theme-mist py-3 pr-4.5 pl-3.5 text-left transition-opacity hover:opacity-85'
    >
      <span className='flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-theme-surface leading-none'>
        <span className='text-[9px] font-bold text-theme-accent uppercase'>
          {getWeekdayLabel(day)}
        </span>
        <span className='text-[15px] font-semibold tabular-nums text-theme-ink'>
          {day.getDate()}
        </span>
      </span>
      <span className='flex flex-col gap-0.5'>
        <span className='text-xs font-bold text-theme-accent'>
          Din nästa tid
        </span>
        <span className='text-sm font-semibold text-theme-ink'>
          {when}, {timeRange(booking.start, booking.end)} ·{' '}
          {booking.resourceName}
        </span>
      </span>
    </button>
  );
}

export function DesktopBooking({
  bookingWindow,
  resources,
  date,
  onSelectDate,
}: BookingProps) {
  const {apartment} = useConfig();

  const {
    data: overview,
    error,
    reload,
  } = useFocusLoad(
    () => fetchOverview(bookingWindow),
    `${bookingWindow.from}:${bookingWindow.to}`,
  );

  const {confirmBook} = useBookingActions(reload);

  const summaries = overview ? summarize(overview.schedule) : null;

  const day: ResourceDay[] | null = overview
    ? resources.map((resource) => {
        const entry = overview.schedule.find(
          (item) => item.resourceId === resource.id,
        );

        return {
          resource,
          slots: entry?.slots.filter((slot) => slot.date === date) ?? [],
          active: entry?.active ?? null,
        };
      })
    : null;

  const nextBooking = overview?.times.bookings.find(
    (booking) => !booking.released,
  );

  return (
    <>
      <PageHeader
        eyebrow={formatHeadingDate(bookingWindow.today)}
        title={`Hej, lägenhet ${apartment}`}
      >
        {nextBooking ? (
          <NextBooking
            booking={nextBooking}
            todayIso={bookingWindow.today}
            onSelectDate={onSelectDate}
          />
        ) : null}
      </PageHeader>
      <div className={`${SHELL} flex items-start gap-7 pt-6 pb-10`}>
        <aside className='flex w-90 shrink-0 flex-col gap-5.5 xl:w-105'>
          <MonthCalendar
            bookingWindow={bookingWindow}
            selected={date}
            onSelect={onSelectDate}
            summaries={summaries}
          />
          {overview || !error ? (
            <section aria-labelledby='my-times-heading'>
              <h2
                id='my-times-heading'
                className='mb-3 ml-0.5 text-base font-semibold tracking-tight text-theme-ink'
              >
                Mina tider
              </h2>
              <MyTimesList
                times={overview?.times ?? null}
                // The day panel shows a failed reload, once for the page.
                error={null}
                reload={reload}
              />
            </section>
          ) : null}
        </aside>
        <DayPanel
          isoDate={date}
          bookingWindow={bookingWindow}
          day={day}
          error={error}
          onRetry={reload}
          onSelectDate={onSelectDate}
          onSelect={(slot, entry) =>
            confirmBook(slot, entry.resource, entry.active)
          }
        />
      </div>
    </>
  );
}
