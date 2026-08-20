import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';
import {theme} from '../../theme';

export type AppTabParamList = {
  Booking: undefined;
  Reservation: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();

export default function AppTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: theme.bg},
        headerShadowVisible: false,
        headerTintColor: theme.ink,
        headerTitleStyle: {fontWeight: '600', fontSize: 17},
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.line,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: {fontSize: 12, fontWeight: '600'},
      }}
    >
      <Tab.Screen
        name='Booking'
        component={BookingScreen}
        options={{title: 'Boka'}}
      />
      <Tab.Screen
        name='Reservation'
        component={ReservationScreen}
        options={{title: 'Mina bokningar'}}
      />
    </Tab.Navigator>
  );
}
