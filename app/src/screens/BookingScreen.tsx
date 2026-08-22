import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {api, unwrap, type Booking, type Slot} from '@/api/client';
import {ApiError} from '@/api/errors';
import {DatePicker} from '@/components/DatePicker';
import {TimeSlotRow} from '@/components/TimeSlotRow';
import {useBookingActions} from '@/hooks/useBookingActions';
import {formatLongDate, getBookableDays, toIsoDate} from '@/lib/dates';

type SlotsFetch = {
  date: string;
  slots: Slot[];
  active: Booking | null;
  error: string | null;
};

export function BookingScreen() {
  const bookableDays = useMemo(() => getBookableDays(), []);
  const [selectedDate, setSelectedDate] = useState(
    () => bookableDays[0] ?? new Date(),
  );
  const [fetched, setFetched] = useState<SlotsFetch | null>(null);
  const isoDate = toIsoDate(selectedDate);

  const load = useCallback(async (date: string) => {
    try {
      const [slots, bookings] = await Promise.all([
        unwrap(api.GET('/slots', {params: {query: {date}}})),
        unwrap(api.GET('/bookings')),
      ]);
      setFetched({date, slots, active: bookings[0] ?? null, error: null});
    } catch (err) {
      setFetched({
        date,
        slots: [],
        active: null,
        error: err instanceof ApiError ? err.message : 'Försök igen.',
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(isoDate);
    }, [load, isoDate]),
  );

  const reload = () => {
    void load(isoDate);
  };
  const {confirmBook} = useBookingActions(reload);

  const ready = fetched?.date === isoDate;
  const error = ready ? fetched.error : null;
  const slots = ready ? fetched.slots : [];
  const active = ready ? fetched.active : null;

  return (
    <View className='flex-1 bg-theme-bg'>
      <DatePicker
        days={bookableDays}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />
      <ScrollView
        className='w-full flex-1 px-5 pt-2'
        contentContainerClassName='w-full grow pb-8'
      >
        <Text className='mb-1 mt-2 text-2xl font-semibold capitalize tracking-tight text-theme-ink'>
          {formatLongDate(isoDate)}
        </Text>
        <Text className='mb-5 text-sm text-theme-muted'>
          Välj en ledig lucka
        </Text>
        {!ready ? (
          <View className='items-center py-12'>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View className='items-center py-12'>
            <Text className='mb-3 text-center text-sm text-theme-muted'>
              {error}
            </Text>
            <Pressable onPress={reload} className='active:opacity-60'>
              <Text className='text-base font-semibold text-theme-accent'>
                Försök igen
              </Text>
            </Pressable>
          </View>
        ) : slots.length === 0 ? (
          <View className='items-center py-12'>
            <Text className='text-center text-sm text-theme-muted'>
              Inga tider kvar den här dagen
            </Text>
          </View>
        ) : (
          slots.map((slot) => (
            <TimeSlotRow
              key={slot.id}
              slot={slot}
              onPress={() => confirmBook(slot, isoDate, active)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
