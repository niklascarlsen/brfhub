import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';
import theme from '@/theme.json';

export type AppTabParamList = {
  Booking: {date?: string; resourceId?: string} | undefined;
  Reservation: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

const BAR_HEIGHT = 49;
const ITEM_PADDING = 5;
const ICON_SLOT = 25;
const ICON_GLYPH = 23;
const LABEL_GAP = 1;
const LABEL_LINE = BAR_HEIGHT - ITEM_PADDING * 2 - ICON_SLOT - LABEL_GAP;

export default function AppTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.line,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.faint,
        tabBarIconStyle: {width: ICON_SLOT, height: ICON_SLOT},
        tabBarLabelStyle: {
          fontFamily: 'Merriweather_600SemiBold',
          fontSize: 11,
          lineHeight: LABEL_LINE,
          marginTop: LABEL_GAP,
        },
      }}
    >
      <Tab.Screen
        name='Booking'
        component={BookingScreen}
        options={{
          title: 'Boka',
          tabBarIcon: ({color}) => (
            <Ionicons name='calendar-outline' size={ICON_GLYPH} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Reservation'
        component={ReservationScreen}
        options={{
          title: 'Mina tider',
          tabBarIcon: ({color}) => (
            <Ionicons name='time-outline' size={ICON_GLYPH} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
