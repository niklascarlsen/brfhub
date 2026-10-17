import type {Locale} from '@booking/core/i18n/catalog';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

import {api, unwrap} from '@/api/client';
import {readPushEnabled} from '@/lib/pushPreference';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Where a tapped notification takes the apartment: a freed slot, or the
// booking screen for an announcement.
export type PushTarget = {date?: string; resourceId?: string};

// The channels the server sends on, listed by name in Android's settings
// for the app so each can be turned off on its own.
export type ChannelNames = {slots: string; announcements: string};

async function ensureChannels(names: ChannelNames): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  for (const [id, name] of Object.entries(names)) {
    await Notifications.setNotificationChannelAsync(id, {
      name,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

// Whether the OS lets the app send push: granted, or deniable once more.
// A denied one can only be turned back on in the phone's settings.
export async function pushPermission(): Promise<
  'granted' | 'askable' | 'blocked'
> {
  const existing = await Notifications.getPermissionsAsync();

  if (existing.granted) {
    return 'granted';
  }

  return existing.canAskAgain ? 'askable' : 'blocked';
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

// Asks the OS when it has not been asked, and sends the token. Answers
// whether the device is registered.
export async function enablePush(locale: Locale): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted;

  if (!granted) {
    return false;
  }

  await sendToken(locale);
  return true;
}

// Runs at start and when the language changes, so the push and the
// channel names Android shows in the app's notification settings follow
// it. A device whose apartment turned push off is left alone.
export async function registerPushToken(
  locale: Locale,
  channels: ChannelNames,
): Promise<void> {
  try {
    await ensureChannels(channels);

    if (await readPushEnabled()) {
      await enablePush(locale);
    }
  } catch (error) {
    console.warn('[push] could not register push token', error);
  }
}

// The OS also reports the token whenever it is asked for it, so a device
// whose apartment turned push off is left alone here too: dropping the
// token asks for it, and must not register it again.
export function onPushTokenChange(locale: Locale): () => void {
  const subscription = Notifications.addPushTokenListener((devicePushToken) => {
    readPushEnabled()
      .then((enabled) => (enabled ? sendToken(locale, devicePushToken) : null))
      .catch((error: unknown) => {
        console.warn('[push] could not register rotated push token', error);
      });
  });

  return () => subscription.remove();
}

function targetOf(response: Notifications.NotificationResponse): PushTarget {
  const data = response.notification.request.content.data ?? {};

  return typeof data.date === 'string' && typeof data.resourceId === 'string'
    ? {date: data.date, resourceId: data.resourceId}
    : {};
}

// A tap that started the app came before the listener, so it is read once
// at start and cleared, or the next start would take the apartment there
// again.
export function onNotificationTap(
  handler: (target: PushTarget) => void,
): () => void {
  const launch = Notifications.getLastNotificationResponse();

  if (launch) {
    handler(targetOf(launch));
    Notifications.clearLastNotificationResponse();
  }

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      handler(targetOf(response));
      Notifications.clearLastNotificationResponse();
    },
  );

  return () => subscription.remove();
}
