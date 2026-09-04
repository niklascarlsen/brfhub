import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';

import {api, unwrap} from '@/api/client';

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

async function ensureSlotChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('slots', {
    name: 'Lediga tider',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function registerPushToken(): Promise<void> {
  try {
    await ensureSlotChannel();

    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') {
      console.warn(
        '[push] no eas.projectId in app config, run: npx eas-cli init',
      );
      return;
    }

    const {data} = await Notifications.getExpoPushTokenAsync({projectId});
    await unwrap(api.POST('/push-tokens', {body: {token: data}}));
  } catch (error) {
    console.warn('[push] could not register push token', error);
  }
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
