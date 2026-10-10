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

import {AdminShell} from '@/admin/AdminShell';
import {AccountGate} from '@/auth/account';
import {SessionGate} from '@/auth/session';
import {ConfigProvider} from '@/config';
import {LocaleProvider, useLocale, useMessages} from '@/i18n/LocaleProvider';
import AppTabNavigator, {
  type AppTabParamList,
} from '@/navigation/AppTabNavigator';
import {onNotificationTap, onPushTokenChange, registerPushToken} from '@/push';

const navigationRef = createNavigationContainerRef<AppTabParamList>();

// Registers the device once an apartment is signed in; the token is tied
// to the apartment on the server.
function PushRegistration() {
  const {locale} = useLocale();
  const channelName = useMessages().push.channel;

  useEffect(() => {
    void registerPushToken(locale, channelName);
    return onPushTokenChange(locale);
  }, [locale, channelName]);

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
    <LocaleProvider>
      <SafeAreaProvider>
        <SessionGate>
          <AccountGate
            member={(account) => (
              <>
                <PushRegistration />
                <ConfigProvider account={account}>
                  <NavigationContainer ref={navigationRef} onReady={onReady}>
                    <AppTabNavigator />
                  </NavigationContainer>
                </ConfigProvider>
              </>
            )}
            admin={(account, refresh) => (
              <AdminShell account={account} onRefresh={refresh} />
            )}
          />
          <StatusBar style='dark' />
        </SessionGate>
      </SafeAreaProvider>
    </LocaleProvider>
  );
}
