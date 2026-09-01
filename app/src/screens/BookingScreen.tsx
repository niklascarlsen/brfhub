import {
  useFocusEffect,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import {useCallback, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {getBookingWindow} from '@/api/bookingWindow';
import {
  api,
  unwrap,
  type Booking,
  type BookingWindow,
  type Resource,
  type Slot,
} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {DatePicker} from '@/components/DatePicker';
import {ResourcePicker} from '@/components/ResourcePicker';
import {TimeSlotRow} from '@/components/TimeSlotRow';
import {useBookingActions} from '@/hooks/useBookingActions';
import type {AppTabParamList} from '@/navigation/AppTabNavigator';
import {daysBetween, formatLongDate, fromIsoDate, toIsoDate} from '@/lib/dates';

type SlotsFetch = {
  date: string;
  resourceId: string;
  resources: Resource[];
  slots: Slot[];
  bookings: Booking[];
  error: string | null;
};

export function BookingScreen() {
  const route = useRoute<RouteProp<AppTabParamList, 'Booking'>>();
  const routeDate = route.params?.date;
  const routeResourceId = route.params?.resourceId;
  const [selectedIso, setSelectedIso] = useState<string | null>(
    routeDate ?? null,
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    routeResourceId ?? null,
  );
  const [lastRouteDate, setLastRouteDate] = useState(routeDate);
  const [lastRouteResourceId, setLastRouteResourceId] =
    useState(routeResourceId);

  if (routeDate !== lastRouteDate) {
    setLastRouteDate(routeDate);
    setSelectedIso(routeDate ?? null);
  }

  if (routeResourceId !== lastRouteResourceId) {
    setLastRouteResourceId(routeResourceId);
    setSelectedResourceId(routeResourceId ?? null);
  }

  const [window, setWindow] = useState<BookingWindow | null>(null);
  const [fetched, setFetched] = useState<SlotsFetch | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(
    async (date: string | null, resourceId: string | null) => {
      const seq = ++loadSeq.current;
      try {
        const [bookingWindow, resourceList] = await Promise.all([
          getBookingWindow(),
          unwrap(api.GET('/resources')),
        ]);
        if (seq !== loadSeq.current) {
          return;
        }

        const target = date ?? bookingWindow.today;
        const resource =
          resourceList.find((item) => item.id === resourceId) ??
          resourceList[0];

        if (!resource) {
          setWindow(bookingWindow);
          setFetched({
            date: target,
            resourceId: '',
            resources: [],
            slots: [],
            bookings: [],
            error: errorMessage('NOT_FOUND'),
          });
          return;
        }

        const [slots, bookings] = await Promise.all([
          unwrap(
            api.GET('/slots', {
              params: {query: {date: target, resourceId: resource.id}},
            }),
          ),
          unwrap(api.GET('/bookings')),
        ]);
        if (seq !== loadSeq.current) {
          return;
        }

        setWindow(bookingWindow);
        setFetched({
          date: target,
          resourceId: resource.id,
          resources: resourceList,
          slots,
          bookings,
          error: null,
        });
      } catch (err) {
        if (seq !== loadSeq.current) {
          return;
        }

        setFetched((prev) => ({
          date: date ?? prev?.date ?? '',
          resourceId: resourceId ?? prev?.resourceId ?? '',
          resources: prev?.resources ?? [],
          slots: [],
          bookings: prev?.bookings ?? [],
          error: errorMessage(codeOf(err)),
        }));
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void load(selectedIso, selectedResourceId);
    }, [load, selectedIso, selectedResourceId]),
  );

  const reload = () => {
    void load(selectedIso, selectedResourceId);
  };
  const {confirmBook} = useBookingActions(reload);

  const bookableDays = useMemo(
    () => (window ? daysBetween(window.from, window.to) : []),
    [window],
  );
  const isoDate = selectedIso ?? window?.today ?? null;
  const resourceId =
    selectedResourceId &&
    fetched?.resources?.some((item) => item.id === selectedResourceId)
      ? selectedResourceId
      : (fetched?.resourceId ?? null);
  const ready =
    isoDate !== null &&
    fetched !== null &&
    fetched.date === isoDate &&
    fetched.resourceId === resourceId;
  const error = ready || isoDate === null ? (fetched?.error ?? null) : null;
  const slots = ready ? fetched.slots : [];
  const resources = fetched?.resources ?? [];
  const resource = resources.find((item) => item.id === resourceId) ?? null;
  const active =
    ready && resource
      ? (fetched.bookings.find(
          (booking) => booking.resourceKind === resource.kind,
        ) ?? null)
      : null;

  const showPicker = resources.length > 0 && resourceId;

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      {showPicker ? (
        <View className='pb-3 pt-1'>
          <ResourcePicker
            resources={resources}
            selectedId={resourceId}
            onSelect={setSelectedResourceId}
          />
        </View>
      ) : null}
      {window && isoDate ? (
        <DatePicker
          days={bookableDays}
          selectedDate={fromIsoDate(isoDate)}
          todayIso={window.today}
          onSelect={(day) => setSelectedIso(toIsoDate(day))}
        />
      ) : null}
      <ScrollView
        className='w-full flex-1'
        contentContainerClassName='w-full grow px-5 pb-8 pt-4'
      >
        <Text className='text-[27px] font-semibold tracking-tight text-theme-ink'>
          {isoDate ? formatLongDate(isoDate) : ''}
        </Text>
        {resource?.hasDryer ? (
          <Text className='mt-1 text-[13px] font-medium text-theme-accent'>
            Med torktumlare
          </Text>
        ) : null}
        <View className='mt-5 gap-[9px]'>
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
                onPress={() =>
                  resource
                    ? confirmBook(slot, isoDate, resource, active)
                    : undefined
                }
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
