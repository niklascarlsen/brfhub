import './global.css';

import {
  Merriweather_400Regular,
  Merriweather_500Medium,
  Merriweather_600SemiBold,
  Merriweather_700Bold,
  useFonts,
} from '@expo-google-fonts/merriweather';
import {
  createNavigationContainerRef,
  NavigationContainer,
} from '@react-navigation/native';
import {StatusBar} from 'expo-status-bar';
import {useCallback, useEffect, useRef} from 'react';
import {View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {SessionGate} from '@/auth/session';
import {ConfigProvider} from '@/config';
import AppTabNavigator, {
  type AppTabParamList,
} from '@/navigation/AppTabNavigator';
import {onNotificationTap, onPushTokenChange, registerPushToken} from '@/push';

const navigationRef = createNavigationContainerRef<AppTabParamList>();

// Registers the device once someone is signed in; the token is tied to
// their apartment on the server.
function PushRegistration() {
  useEffect(() => {
    void registerPushToken();
    return onPushTokenChange();
  }, []);

  return null;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Merriweather_400Regular,
    Merriweather_500Medium,
    Merriweather_600SemiBold,
    Merriweather_700Bold,
  });
  const pending = useRef<AppTabParamList['Booking']>(undefined);

  useEffect(
    () =>
      onNotificationTap((target) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Booking', target);
          return;
        }

        pending.current = target;
      }),
    [],
  );

  const onReady = useCallback(() => {
    const target = pending.current;

    if (target) {
      pending.current = undefined;
      navigationRef.navigate('Booking', target);
    }
  }, []);

  if (!fontsLoaded && fontError === null) {
    return <View className='flex-1 bg-theme-bg' />;
  }

  return (
    <SafeAreaProvider>
      <SessionGate>
        <PushRegistration />
        <ConfigProvider>
          <NavigationContainer ref={navigationRef} onReady={onReady}>
            <AppTabNavigator />
            <StatusBar style='dark' />
          </NavigationContainer>
        </ConfigProvider>
      </SessionGate>
    </SafeAreaProvider>
  );
}
