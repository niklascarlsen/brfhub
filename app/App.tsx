import './global.css';

import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useRef} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {ConfigProvider} from '@/config';
import AppTabNavigator, {
  type AppTabParamList,
} from '@/navigation/AppTabNavigator';
import {onNotificationTap, registerPushToken} from '@/push';

const navigationRef = createNavigationContainerRef<AppTabParamList>();

export default function App() {
  const pending = useRef<AppTabParamList['Booking']>(undefined);

  useEffect(() => {
    void registerPushToken();

    return onNotificationTap((target) => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Booking', target);
        return;
      }

      pending.current = target;
    });
  }, []);

  const onReady = useCallback(() => {
    const target = pending.current;

    if (target) {
      pending.current = undefined;
      navigationRef.navigate('Booking', target);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ConfigProvider>
        <NavigationContainer ref={navigationRef} onReady={onReady}>
          <AppTabNavigator />
          <StatusBar style='dark' />
        </NavigationContainer>
      </ConfigProvider>
    </SafeAreaProvider>
  );
}
