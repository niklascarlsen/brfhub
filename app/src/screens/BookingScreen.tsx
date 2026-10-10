import {useRoute, type RouteProp} from '@react-navigation/native';
import {useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap} from '@/api/client';
import {AnnouncementBanner} from '@/components/Announcements';
import {BookingHeader} from '@/components/BookingHeader';
import {SlotList} from '@/components/SlotList';
import {useConfig} from '@/config';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useResetWhenChanged} from '@/hooks/useResetWhenChanged';
import {useMessages} from '@/i18n/LocaleProvider';
import {formatLongDate, isWithinBookingWindow} from '@/lib/dates';
import type {AppTabParamList} from '@/navigation/AppTabNavigator';

function fetchDay(isoDate: string, resourceId: string) {
  return unwrap(
    api.GET('/slots', {params: {query: {date: isoDate, resourceId}}}),
  );
}

export function BookingScreen() {
  const {window, resources} = useConfig();
  const t = useMessages();
  const route = useRoute<RouteProp<AppTabParamList, 'Booking'>>();
  const routeDate = route.params?.date;
  const routeResourceId = route.params?.resourceId;

  const [chosen, setChosen] = useState(routeDate ?? window.today);
  const [resourceId, setResourceId] = useState(
    routeResourceId ?? resources[0].id,
  );

  // The params object is new on every navigate, the values are not.
  useResetWhenChanged(route.params, () => {
    setChosen(routeDate ?? window.today);
    setResourceId(routeResourceId ?? resources[0].id);
  });

  const date = isWithinBookingWindow(chosen, window) ? chosen : window.today;
  const resource =
    resources.find((item) => item.id === resourceId) ?? resources[0];

  const {
    data: day,
    error,
    reload,
  } = useFocusLoad(() => fetchDay(date, resource.id), `${date}:${resource.id}`);

  const {confirmBook} = useBookingActions(reload);

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <BookingHeader
        resources={resources}
        resource={resource}
        onSelectResource={setResourceId}
        bookingWindow={window}
        isoDate={date}
        onSelectDate={setChosen}
      />
      <ScrollView
        className='w-full flex-1'
        contentContainerClassName='w-full grow px-5 pb-8 pt-4'
      >
        <AnnouncementBanner className='mb-4' />
        <Text className='text-[27px] font-semibold tracking-tight text-theme-ink'>
          {formatLongDate(date, t)}
        </Text>
        {resource.tags.length > 0 ? (
          <View className='mt-2 mb-1 flex-row flex-wrap gap-[6px]'>
            {resource.tags.map((tag) => (
              <View
                key={tag}
                className='self-start rounded-full bg-theme-mist px-[9px] py-1'
              >
                <Text className='text-[10px] font-bold uppercase tracking-[0.5px] text-theme-accent'>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <View className='mt-5 grow'>
          <SlotList
            slots={day?.slots ?? null}
            error={error}
            onRetry={reload}
            onSelect={(slot) =>
              confirmBook(slot, resource, day?.active ?? null)
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
