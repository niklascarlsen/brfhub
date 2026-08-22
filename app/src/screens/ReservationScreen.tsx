import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {api, unwrap, type Booking, type Subscription} from '@/api/client';
import {ApiError} from '@/api/errors';
import {TimeCard} from '@/components/TimeCard';
import {useBookingActions} from '@/hooks/useBookingActions';
import {formatWhen, timeRange} from '@/lib/dates';

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
        error: err instanceof ApiError ? err.message : 'Försök igen.',
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const {confirmCancel, confirmUnsubscribe} = useBookingActions(() => {
    void load();
  });

  if (!fetched) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg'>
        <ActivityIndicator />
      </View>
    );
  }

  if (fetched.error) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg px-8'>
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
      </View>
    );
  }

  if (fetched.times.length === 0) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg px-8'>
        <Text className='text-center text-xl font-semibold text-theme-ink'>
          Inga tider
        </Text>
        <Text className='mt-2 text-center text-sm leading-5 text-theme-muted'>
          När du tar en lucka eller ställer dig i kö dyker den upp här.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className='flex-1 bg-theme-bg'
      contentContainerClassName='px-5 py-4 pb-8'
    >
      <Text className='mb-3 text-base font-medium text-theme-muted'>
        {fetched.times.length === 1 ? '1 tid' : `${fetched.times.length} tider`}
      </Text>
      {fetched.times.map(({kind, entry}) => {
        const when = formatWhen(entry.date, timeRange(entry.start, entry.end));

        if (kind === 'booking') {
          return (
            <TimeCard
              key={entry.id}
              date={entry.date}
              start={entry.start}
              end={entry.end}
              badge={null}
              actionLabel='Avboka'
              onAction={() => confirmCancel({id: entry.id, when})}
            />
          );
        }

        return (
          <TimeCard
            key={entry.id}
            date={entry.date}
            start={entry.start}
            end={entry.end}
            badge={entry.available ? 'Ledig nu' : 'Reserv'}
            actionLabel='Lämna kön'
            onAction={() => confirmUnsubscribe({id: entry.id, when})}
          />
        );
      })}
    </ScrollView>
  );
}
