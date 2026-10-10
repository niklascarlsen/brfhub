import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

import {api, unwrap} from '@/api/client';
import type {Locale} from '@/i18n/catalog';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type ReleasedSlotData = {
  date: string;
  resourceId: string;
};

async function ensureSlotChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('slots', {
    name,
    importance: Notifications.AndroidImportance.HIGH,
  });
}

async function expoPushToken(
  devicePushToken?: Notifications.DevicePushToken,
): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (typeof projectId !== 'string') {
    console.warn(
      '[push] no eas.projectId in app config, run: npx eas-cli init',
    );
    return null;
  }

  const {data} = await Notifications.getExpoPushTokenAsync({
    projectId,
    devicePushToken,
  });

  return data;
}

// The server writes this device's push in its language.
async function sendToken(
  locale: Locale,
  devicePushToken?: Notifications.DevicePushToken,
): Promise<void> {
  const token = await expoPushToken(devicePushToken);

  if (token !== null) {
    await unwrap(api.POST('/push-tokens', {body: {token, locale}}));
  }
}

// Signing out must not leave this device on the apartment's queue. Only
// a device that was allowed to register has a token to drop.
export async function dropPushToken(): Promise<void> {
  if (!(await Notifications.getPermissionsAsync()).granted) {
    return;
  }

  const token = await expoPushToken();

  if (token !== null) {
    await unwrap(api.DELETE('/push-tokens', {body: {token}}));
  }
}

// Runs again when the language changes, so the push and the channel name
// Android shows in the app's notification settings follow it.
export async function registerPushToken(
  locale: Locale,
  channelName: string,
): Promise<void> {
  try {
    await ensureSlotChannel(channelName);

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) {
      return;
    }

    await sendToken(locale);
  } catch (error) {
    console.warn('[push] could not register push token', error);
  }
}

export function onPushTokenChange(locale: Locale): () => void {
  const subscription = Notifications.addPushTokenListener((devicePushToken) => {
    sendToken(locale, devicePushToken).catch((error: unknown) => {
      console.warn('[push] could not register rotated push token', error);
    });
  });

  return () => subscription.remove();
}

export function onNotificationTap(
  handler: (data: ReleasedSlotData) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data ?? {};

      if (
        typeof data.date === 'string' &&
        typeof data.resourceId === 'string'
      ) {
        handler({date: data.date, resourceId: data.resourceId});
      }
    },
  );

  return () => subscription.remove();
}
