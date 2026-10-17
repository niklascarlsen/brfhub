import * as Linking from 'expo-linking';
import {useEffect, useState} from 'react';
import {Switch, Text, View} from 'react-native';

import {useDialog} from '@/components/Dialog';
import {useOnReturn} from '@/hooks/useOnReturn';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import {readPushEnabled, savePushEnabled} from '@/lib/pushPreference';
import {dropPushToken, enablePush, pushPermission} from '@/push';
import {theme} from '@/theme';

async function isOn(): Promise<boolean> {
  const [wanted, permission] = await Promise.all([
    readPushEnabled(),
    pushPermission(),
  ]);

  return wanted && permission === 'granted';
}

// Push on this device, under the account. Off drops the device's token;
// on registers it again, asking the OS when it has not been asked. Once
// the OS has been told no, only its settings can say yes, so the switch
// opens them.
export function PushToggle() {
  const t = useMessages();
  const dialog = useDialog();
  const {locale} = useLocale();
  // Null until both the preference and the OS have answered.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;

    void isOn().then((on) => {
      if (current) {
        setEnabled(on);
      }
    });

    return () => {
      current = false;
    };
  }, []);

  // Back from the phone's settings, where the switch sends a device the OS
  // has been told no on: allowed there, the device registers at once
  // instead of at the next start.
  useOnReturn(() => {
    if (enabled !== false || busy) {
      return;
    }

    // Busy until done, so the switch cannot be turned off meanwhile and
    // then be turned back on when this finishes.
    setBusy(true);
    isOn()
      .then(async (on) => {
        if (on) {
          setEnabled(await enablePush(locale));
        }
      })
      .catch((error: unknown) => {
        console.warn('[push] could not register push token', error);
      })
      .finally(() => setBusy(false));
  });

  const change = async (next: boolean) => {
    setBusy(true);

    try {
      if (!next) {
        await savePushEnabled(false);
        await dropPushToken();
        setEnabled(false);
        return;
      }

      // The wish is kept, so allowing push in the settings turns it on.
      await savePushEnabled(true);

      if ((await pushPermission()) === 'blocked') {
        dialog.confirm(t.push.blockedTitle, t.push.blockedMessage, {
          label: t.push.openSettings,
          onPress: () => {
            void Linking.openSettings();
          },
        });
        return;
      }

      setEnabled(await enablePush(locale));
    } catch (error) {
      console.warn('[push] could not change push', error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className='mt-2.5 flex-row items-center gap-3.5 rounded-card border border-theme-line bg-theme-surface px-[18px] py-4'>
      <View className='min-w-0 flex-1 gap-1'>
        <Text className='text-sm font-semibold text-theme-ink'>
          {t.push.toggle}
        </Text>
        <Text className='font-sans text-[13px] leading-[18px] text-theme-muted'>
          {t.push.toggleHint}
        </Text>
      </View>
      <Switch
        accessibilityLabel={t.push.toggle}
        value={enabled === true}
        disabled={enabled === null || busy}
        onValueChange={(value) => void change(value)}
        trackColor={{true: theme.ink, false: theme.line}}
        thumbColor={theme.surface}
      />
    </View>
  );
}
