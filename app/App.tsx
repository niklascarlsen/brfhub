import './global.css';

import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useEffect} from 'react';

import AppTabNavigator, {
  type AppTabParamList,
} from '@/navigation/AppTabNavigator';
import {onNotificationTap, registerPushToken} from '@/push';

const navigationRef = createNavigationContainerRef<AppTabParamList>();

export default function App() {
  useEffect(() => {
    void registerPushToken();

    return onNotificationTap(({date}) => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Booking', {date});
      }
    });
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <AppTabNavigator />
      <StatusBar style='dark' />
    </NavigationContainer>
  );
}
