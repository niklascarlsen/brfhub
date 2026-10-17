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
import type {Mode} from '@booking/core/auth/account';
import {SwitchModeContext} from '@booking/core/auth/mode';
import {useCallback, useEffect, useRef, useState} from 'react';
import {LogBox, View} from 'react-native';
import {KeyboardProvider} from 'react-native-keyboard-controller';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AdminShell} from '@/admin/AdminShell';
import {TwoFactorSetup} from '@/screens/TwoFactorSetup';
import {AccountGate} from '@/auth/account';
import {SessionGate} from '@/auth/session';
import {DialogProvider} from '@/components/Dialog';
import {ConfigProvider} from '@/config';
import {LocaleProvider, useLocale, useMessages} from '@/i18n/LocaleProvider';
import AppTabNavigator, {
  type AppTabParamList,
} from '@/navigation/AppTabNavigator';
import {onNotificationTap, onPushTokenChange, registerPushToken} from '@/push';

// NativeWind wraps every React Native component as it loads, ImageBackground
// too, which React Native 0.88 deprecates and warns about on first touch. We
// draw none ourselves, so the warning says nothing about this app.
LogBox.ignoreLogs(['ImageBackground is deprecated']);

const navigationRef = createNavigationContainerRef<AppTabParamList>();

// Registers the device once an apartment is signed in; the token is tied
// to the apartment on the server.
function PushRegistration() {
  const {locale} = useLocale();
  const t = useMessages();
  const slots = t.push.channel;
  const announcements = t.push.announcementsChannel;

  useEffect(() => {
    void registerPushToken(locale, {slots, announcements});
    return onPushTokenChange(locale);
  }, [locale, slots, announcements]);

  return null;
}

// Which app an account that both books and manages is shown. Lives under
// SessionGate, so signing out forgets it.
function Gate({onReady}: {onReady: () => void}) {
  const [mode, setMode] = useState<Mode | null>(null);

  return (
    <SwitchModeContext.Provider value={setMode}>
      <AccountGate
        mode={mode}
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
        twoFactorSetup={(account, refresh) => (
          <TwoFactorSetup account={account} onDone={refresh} />
        )}
      />
    </SwitchModeContext.Provider>
  );
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
        <KeyboardProvider>
          <DialogProvider>
            <SessionGate>
              <Gate onReady={onReady} />
            </SessionGate>
            {/* Outside the gate, so the sign-in screen gets it too. */}
            <StatusBar style='dark' />
          </DialogProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </LocaleProvider>
  );
}
