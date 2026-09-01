import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useState, type ReactNode} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap, type Booking, type Subscription} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {TimeCard} from '@/components/TimeCard';
import {useBookingActions} from '@/hooks/useBookingActions';

type MyTime =
  | {kind: 'booking'; entry: Booking}
  | {kind: 'subscription'; entry: Subscription};

type TimesFetch = {
  times: MyTime[];
  error: string | null;
};

function sortByWhen(times: MyTime[]): MyTime[] {
  return [...times].sort(
    (a, b) =>
      a.entry.date.localeCompare(b.entry.date) ||
      a.entry.start.localeCompare(b.entry.start),
  );
}

function TimesSection({
  title,
  times,
  children,
}: {
  title: string;
  times: MyTime[];
  children: ReactNode;
}) {
  if (times.length === 0) {
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

export function ReservationScreen() {
  const [fetched, setFetched] = useState<TimesFetch | null>(null);

  const load = useCallback(async () => {
    try {
      const [bookings, subscriptions] = await Promise.all([
        unwrap(api.GET('/bookings')),
        unwrap(api.GET('/subscriptions')),
      ]);

      setFetched({
        times: sortByWhen([
          ...bookings.map((entry) => ({kind: 'booking' as const, entry})),
          ...subscriptions.map((entry) => ({
            kind: 'subscription' as const,
            entry,
          })),
        ]),
        error: null,
      });
    } catch (err) {
      setFetched({
        times: [],
        error: errorMessage(codeOf(err)),
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const {confirmBookable, confirmCancel, confirmRelease, confirmUnsubscribe} =
    useBookingActions(() => {
      void load();
    });

  if (!fetched) {
    return (
      <SafeAreaView
        className='flex-1 items-center justify-center bg-theme-bg'
        edges={['top']}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (fetched.error) {
    return (
      <SafeAreaView
        className='flex-1 items-center justify-center bg-theme-bg px-8'
        edges={['top']}
      >
        <Text className='text-center text-sm text-theme-muted'>
          {fetched.error}
        </Text>
        <Pressable
          onPress={() => {
            setFetched(null);
            void load();
          }}
          className='mt-3 active:opacity-60'
        >
          <Text className='text-base font-semibold text-theme-accent'>
            Försök igen
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (fetched.times.length === 0) {
    return (
      <SafeAreaView
        className='flex-1 items-center justify-center bg-theme-bg px-8'
        edges={['top']}
      >
        <Text className='text-center text-xl font-semibold text-theme-ink'>
          Inga tider
        </Text>
        <Text className='mt-2 text-center text-sm leading-5 text-theme-muted'>
          När du tar en lucka eller ställer dig i kö dyker den upp här.
        </Text>
      </SafeAreaView>
    );
  }

  const bookings = fetched.times.filter(
    (time): time is {kind: 'booking'; entry: Booking} =>
      time.kind === 'booking',
  );
  const reservations = fetched.times.filter(
    (time): time is {kind: 'subscription'; entry: Subscription} =>
      time.kind === 'subscription',
  );

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <ScrollView className='flex-1' contentContainerClassName='px-5 pb-8 pt-2'>
        <Text className='mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Mina tider
        </Text>
        <TimesSection title='Bokningar' times={bookings}>
          {bookings.map(({entry}) => {
            if (entry.released) {
              return (
                <TimeCard
                  key={entry.id}
                  date={entry.date}
                  start={entry.start}
                  end={entry.end}
                  resourceName={entry.resourceName}
                  badge={{label: 'Avslutad', tone: 'muted'}}
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
                actionLabel={entry.started ? 'Jag är klar' : 'Avboka'}
                onAction={() =>
                  entry.started ? confirmRelease(entry) : confirmCancel(entry)
                }
              />
            );
          })}
        </TimesSection>
        <TimesSection title='Reserv' times={reservations}>
          {reservations.map(({entry}) => {
            const bookable = entry.available && !entry.started;
            const activeSameKind =
              bookings.find(
                (time) => time.entry.resourceKind === entry.resourceKind,
              )?.entry ?? null;

            return (
              <TimeCard
                key={entry.id}
                date={entry.date}
                start={entry.start}
                end={entry.end}
                resourceName={entry.resourceName}
                badge={
                  entry.available && entry.started
                    ? {label: 'Drop-in', tone: 'accent'}
                    : entry.available
                      ? {label: 'Ledig nu', tone: 'accent'}
                      : {label: 'Reserv', tone: 'muted'}
                }
                actionLabel={bookable ? 'Boka' : 'Lämna kön'}
                actionTone={bookable ? 'solid' : 'outline'}
                onAction={() =>
                  bookable
                    ? confirmBookable(entry, activeSameKind)
                    : confirmUnsubscribe(entry)
                }
                secondaryLabel={bookable ? 'Lämna kön' : undefined}
                onSecondary={
                  bookable ? () => confirmUnsubscribe(entry) : undefined
                }
              />
            );
          })}
        </TimesSection>
      </ScrollView>
    </SafeAreaView>
  );
}
