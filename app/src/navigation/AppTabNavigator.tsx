import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import {useMessages} from '@/i18n/LocaleProvider';
import {ApartmentScreen} from '@/screens/ApartmentScreen';
import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';
import {TAB_ICON_GLYPH, TAB_SCREEN_OPTIONS} from '@/navigation/tabOptions';

export type AppTabParamList = {
  Booking: {date?: string; resourceId?: string} | undefined;
  Reservation: undefined;
  Apartment: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppTabNavigator() {
  const t = useMessages();

  return (
    <Tab.Navigator screenOptions={TAB_SCREEN_OPTIONS}>
      <Tab.Screen
        name='Booking'
        component={BookingScreen}
        options={{
          title: t.tabs.book,
          tabBarIcon: ({color}) => (
            <Ionicons
              name='calendar-outline'
              size={TAB_ICON_GLYPH}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name='Reservation'
        component={ReservationScreen}
        options={{
          title: t.tabs.myTimes,
          tabBarIcon: ({color}) => (
            <Ionicons name='time-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Apartment'
        component={ApartmentScreen}
        options={{
          title: t.tabs.apartment,
          tabBarIcon: ({color}) => (
            <Ionicons name='home-outline' size={TAB_ICON_GLYPH} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
