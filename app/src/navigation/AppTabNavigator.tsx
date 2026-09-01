import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';
import {theme} from '../../theme';

export type AppTabParamList = {
  Booking: {date?: string; resourceId?: string} | undefined;
  Reservation: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
        },
        tabBarActiveTintColor: theme.ink,
        tabBarInactiveTintColor: theme.faint,
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600', marginTop: 4},
      }}
    >
      <Tab.Screen
        name='Booking'
        component={BookingScreen}
        options={{
          title: 'Boka',
          tabBarIcon: ({color, size}) => (
            <Ionicons name='calendar-outline' size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name='Reservation'
        component={ReservationScreen}
        options={{
          title: 'Mina tider',
          tabBarIcon: ({color, size}) => (
            <Ionicons name='time-outline' size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
