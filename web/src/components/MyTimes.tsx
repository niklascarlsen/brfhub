import type {ReactNode} from 'react';

import {api, unwrap} from '@/api/client';
import {Notice, NoticeBar} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {TimeCard, TimeCardSkeleton} from '@/components/TimeCard';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {useMessages} from '@/i18n/LocaleProvider';

function TimesSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) {
    return null;
  }

  return (
    <div className='mb-6.5'>
      <p className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
        {title}
      </p>
      <div className='flex flex-col gap-2.5'>{children}</div>
    </div>
  );
}

async function fetchBookingsAndSubscriptions() {
  const [bookings, subscriptions] = await Promise.all([
    unwrap(api.GET('/bookings')),
    unwrap(api.GET('/subscriptions')),
  ]);

  return {bookings, subscriptions};
}

export type Times = Awaited<ReturnType<typeof fetchBookingsAndSubscriptions>>;

export function MyTimes() {
  const {
    data: times,
    error,
    reload,
  } = useFocusLoad(fetchBookingsAndSubscriptions);

  return <MyTimesList times={times} error={error} reload={reload} />;
}

// The list without its own loading, for a page that loads the times
// together with something else and reloads both at once.
export function MyTimesList({
  times,
  error,
  reload,
}: {
  times: Times | null;
  error: string | null;
  reload: () => void;
}) {
  const {confirmBookable, confirmCancel, confirmRelease, confirmUnsubscribe} =
    useBookingActions(reload);
  const t = useMessages();

  const showSkeleton = useSlowLoad(times === null && error === null);

  if (!times) {
    if (error) {
      return (
        <Notice
          message={error}
          actionLabel={t.common.retry}
          onAction={reload}
        />
      );
    }

    return showSkeleton ? (
      <Skeleton>
        <SkeletonBar className='mb-2.5 ml-0.5 h-3 w-22' />
        <div className='flex flex-col gap-2.5'>
          <TimeCardSkeleton />
          <TimeCardSkeleton />
        </div>
      </Skeleton>
    ) : null;
  }

  const {bookings, subscriptions} = times;

  if (bookings.length === 0 && subscriptions.length === 0) {
    return error ? (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    ) : (
      <Notice title={t.times.emptyTitle} message={t.times.emptyMessage} />
    );
  }

  return (
    <>
      {error ? (
        <NoticeBar
          message={error}
          actionLabel={t.common.retry}
          onAction={reload}
        />
      ) : null}
      <TimesSection title={t.times.bookings} count={bookings.length}>
        {bookings.map((entry) => {
          if (entry.released) {
            return (
              <TimeCard
                key={entry.id}
                date={entry.date}
                start={entry.start}
                end={entry.end}
                resourceName={entry.resourceName}
                badge={{label: t.times.ended, tone: 'muted'}}
              />
            );
          }

          return (
            <TimeCard
              key={entry.id}
              date={entry.date}
              start={entry.start}
              end={entry.end}
              resourceName={entry.resourceName}
              badge={null}
              actionLabel={entry.started ? t.times.done : t.times.cancel}
              onAction={() =>
                entry.started ? confirmRelease(entry) : confirmCancel(entry)
              }
            />
          );
        })}
      </TimesSection>
      <TimesSection title={t.times.queue} count={subscriptions.length}>
        {subscriptions.map((entry) => {
          const bookable = entry.available && !entry.started;
          const activeSameKind =
            bookings.find(
              (booking) => booking.resourceKind === entry.resourceKind,
            ) ?? null;

          return (
            <TimeCard
              key={entry.id}
              date={entry.date}
              start={entry.start}
              end={entry.end}
              resourceName={entry.resourceName}
              badge={
                entry.available && entry.started
                  ? {label: t.times.dropIn, tone: 'accent'}
                  : entry.available
                    ? {label: t.times.freeNow, tone: 'accent'}
                    : {label: t.times.queue, tone: 'muted'}
              }
              actionLabel={bookable ? t.times.book : t.times.leaveQueue}
              actionTone={bookable ? 'solid' : 'outline'}
              onAction={() =>
                bookable
                  ? confirmBookable(entry, activeSameKind)
                  : confirmUnsubscribe(entry)
              }
              secondaryLabel={bookable ? t.times.leaveQueue : undefined}
              onSecondary={
                bookable ? () => confirmUnsubscribe(entry) : undefined
              }
            />
          );
        })}
      </TimesSection>
    </>
  );
}
