import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {getBookingWindow} from '@/api/bookingWindow';
import {
  api,
  unwrap,
  type Booking,
  type BookingWindow,
  type Slot,
} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {DatePicker} from '@/components/DatePicker';
import {TimeSlotRow} from '@/components/TimeSlotRow';
import {useBookingActions} from '@/hooks/useBookingActions';
import type {AppTabParamList} from '@/navigation/AppTabNavigator';
import {daysBetween, formatLongDate, fromIsoDate, toIsoDate} from '@/lib/dates';

type SlotsFetch = {
  date: string;
  slots: Slot[];
  active: Booking | null;
  error: string | null;
};

export function BookingScreen() {
  const route = useRoute<RouteProp<AppTabParamList, 'Booking'>>();
  const routeDate = route.params?.date;
  const [selectedIso, setSelectedIso] = useState<string | null>(
    routeDate ?? null,
  );
  const [lastRouteDate, setLastRouteDate] = useState(routeDate);

  if (routeDate !== lastRouteDate) {
    setLastRouteDate(routeDate);
    setSelectedIso(routeDate ?? null);
  }

  const [window, setWindow] = useState<BookingWindow | null>(null);
  const [fetched, setFetched] = useState<SlotsFetch | null>(null);

  const load = useCallback(async (date: string | null) => {
    try {
      const bookingWindow = await getBookingWindow();
      const target = date ?? bookingWindow.today;
      const [slots, bookings] = await Promise.all([
        unwrap(api.GET('/slots', {params: {query: {date: target}}})),
        unwrap(api.GET('/bookings')),
      ]);
      setWindow(bookingWindow);
      setFetched({
        date: target,
        slots,
        active: bookings[0] ?? null,
        error: null,
      });
    } catch (err) {
      setFetched({
        date: date ?? '',
        slots: [],
        active: null,
        error: errorMessage(codeOf(err)),
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(selectedIso);
    }, [load, selectedIso]),
  );

  const reload = () => {
    void load(selectedIso);
  };
  const {confirmBook} = useBookingActions(reload);

  const bookableDays = useMemo(
    () => (window ? daysBetween(window.from, window.to) : []),
    [window],
  );
  const isoDate = selectedIso ?? window?.today ?? null;
  const ready = isoDate !== null && fetched?.date === isoDate;
  const error = ready || isoDate === null ? (fetched?.error ?? null) : null;
  const slots = ready ? fetched.slots : [];
  const active = ready ? fetched.active : null;

  return (
    <View className='flex-1 bg-theme-bg'>
      {window && isoDate ? (
        <DatePicker
          days={bookableDays}
          selectedDate={fromIsoDate(isoDate)}
          todayIso={window.today}
          onSelect={(day) => setSelectedIso(toIsoDate(day))}
        />
      ) : null}
      <ScrollView
        className='w-full flex-1 px-5 pt-2'
        contentContainerClassName='w-full grow pb-8'
      >
        <Text className='mb-1 mt-2 text-2xl font-semibold capitalize tracking-tight text-theme-ink'>
          {isoDate ? formatLongDate(isoDate) : ''}
        </Text>
        <Text className='mb-5 text-sm text-theme-muted'>
          Välj en ledig lucka
        </Text>
        {error ? (
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
        ) : !ready ? (
          <View className='items-center py-12'>
            <ActivityIndicator />
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
