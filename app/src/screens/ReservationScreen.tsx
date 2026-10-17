import {
  bookingCard,
  queueCard,
  type BookingAction,
  type CardOffer,
} from '@brfhub/core/booking/offer';
import {useSlowLoad} from '@brfhub/core/hooks/useSlowLoad';
import {type ReactNode} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap} from '@/api/client';
import {Notice, NoticeBar} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {usePageEnd} from '@/components/TabBar';
import {TimeCard, TimeCardSkeleton} from '@/components/TimeCard';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

function TimesPage({children}: {children: ReactNode}) {
  const pageEnd = usePageEnd();
  const t = useMessages();

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <ScrollView
        className='flex-1'
        contentContainerClassName='grow px-5 pt-2'
        contentContainerStyle={{paddingBottom: pageEnd}}
      >
        <Text className='mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.tabs.myTimes}
        </Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

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
    <View className='mb-[26px]'>
      <Text className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
        {title}
      </Text>
      <View className='gap-2.5'>{children}</View>
    </View>
  );
}

// What a card offers, as the props TimeCard takes.
function cardActions(
  {ended, badge, primary, secondary}: CardOffer,
  confirm: (action: BookingAction) => void,
) {
  return {
    ended,
    badge,
    actionLabel: primary?.label,
    actionTone: primary?.solid ? ('solid' as const) : ('outline' as const),
    onAction: primary ? () => confirm(primary.action) : undefined,
    secondaryLabel: secondary?.label,
    onSecondary: secondary ? () => confirm(secondary.action) : undefined,
  };
}

async function fetchBookingsAndSubscriptions() {
  const [bookings, subscriptions] = await Promise.all([
    unwrap(api.GET('/bookings')),
    unwrap(api.GET('/subscriptions')),
  ]);

  return {bookings, subscriptions};
}

export function ReservationScreen() {
  const {
    data: times,
    error,
    reload,
  } = useFocusLoad(fetchBookingsAndSubscriptions);

  const {confirm} = useBookingActions(reload);
  const t = useMessages();

  const showSkeleton = useSlowLoad(times === null && error === null);

  if (!times) {
    return (
      <TimesPage>
        {error ? (
          <Notice
            message={error}
            actionLabel={t.common.retry}
            onAction={reload}
          />
        ) : showSkeleton ? (
          <Skeleton>
            <SkeletonBar className='mb-2.5 ml-0.5 h-3 w-[88px]' />
            <View className='gap-2.5'>
              <TimeCardSkeleton />
              <TimeCardSkeleton />
            </View>
          </Skeleton>
        ) : null}
      </TimesPage>
    );
  }

  const {bookings, subscriptions} = times;

  if (bookings.length === 0 && subscriptions.length === 0) {
    return (
      <TimesPage>
        {error ? (
          <Notice
            message={error}
            actionLabel={t.common.retry}
            onAction={reload}
          />
        ) : (
          <Notice title={t.times.emptyTitle} message={t.times.emptyMessage} />
        )}
      </TimesPage>
    );
  }

  return (
    <TimesPage>
      {error ? (
        <NoticeBar
          message={error}
          actionLabel={t.common.retry}
          onAction={reload}
        />
      ) : null}
      <TimesSection title={t.times.bookings} count={bookings.length}>
        {bookings.map((entry) => (
          <TimeCard
            key={entry.id}
            date={entry.date}
            start={entry.start}
            end={entry.end}
            resourceName={entry.resourceName}
            {...cardActions(bookingCard(entry, t), confirm)}
          />
        ))}
      </TimesSection>
      <TimesSection title={t.times.queue} count={subscriptions.length}>
        {subscriptions.map((entry) => (
          <TimeCard
            key={entry.id}
            date={entry.date}
            start={entry.start}
            end={entry.end}
            resourceName={entry.resourceName}
            {...cardActions(queueCard(entry, t), confirm)}
          />
        ))}
      </TimesSection>
    </TimesPage>
  );
}
