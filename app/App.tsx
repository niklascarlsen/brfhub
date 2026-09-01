import './global.css';

import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useEffect} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import AppTabNavigator, {
  type AppTabParamList,
} from '@/navigation/AppTabNavigator';
import {onNotificationTap, registerPushToken} from '@/push';

const navigationRef = createNavigationContainerRef<AppTabParamList>();

export default function App() {
  useEffect(() => {
    void registerPushToken();

    return onNotificationTap(({date, resourceId}) => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Booking', {date, resourceId});
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <AppTabNavigator />
        <StatusBar style='dark' />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
