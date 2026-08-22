import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {api, unwrap, type Booking} from '@/api/client';
import {ApiError} from '@/api/errors';
import {ReservationCard} from '@/components/ReservationCard';
import {useBookingActions} from '@/hooks/useBookingActions';
import {formatWhen, timeRange} from '@/lib/dates';

type BookingsFetch = {
  bookings: Booking[];
  error: string | null;
};

export function ReservationScreen() {
  const [fetched, setFetched] = useState<BookingsFetch | null>(null);

  const load = useCallback(async () => {
    try {
      const bookings = await unwrap(api.GET('/bookings'));
      setFetched({bookings, error: null});
    } catch (err) {
      setFetched({
        bookings: [],
        error: err instanceof ApiError ? err.message : 'Försök igen.',
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const {confirmCancel} = useBookingActions(() => {
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

  const sorted = [...fetched.bookings].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  );

  if (sorted.length === 0) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg px-8'>
        <Text className='text-center text-xl font-semibold text-theme-ink'>
          Inga tider bokade
        </Text>
        <Text className='mt-2 text-center text-sm leading-5 text-theme-muted'>
          När du tar en lucka dyker den upp här.
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
        {sorted.length === 1 ? '1 bokning' : `${sorted.length} bokningar`}
      </Text>
      {sorted.map((booking) => {
        const when = formatWhen(
          booking.date,
          timeRange(booking.start, booking.end),
        );

        return (
          <ReservationCard
            key={booking.id}
            booking={booking}
            onCancel={() => confirmCancel({id: booking.id, when})}
          />
        );
      })}
    </ScrollView>
  );
}
