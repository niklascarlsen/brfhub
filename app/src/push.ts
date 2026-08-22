import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import {api, unwrap} from '@/api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type ReleasedSlotData = {
  date: string;
  slotId: string;
};

export async function registerPushToken(): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (await Notifications.requestPermissionsAsync()).granted;

    if (!granted) {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (typeof projectId !== 'string') {
      return;
    }

    const {data} = await Notifications.getExpoPushTokenAsync({projectId});
    await unwrap(api.POST('/push-tokens', {body: {token: data}}));
  } catch {
    return;
  }
}

export function onNotificationTap(
  handler: (data: ReleasedSlotData) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data ?? {};

      if (typeof data.date === 'string' && typeof data.slotId === 'string') {
        handler({date: data.date, slotId: data.slotId});
      }
    },
  );

  return () => subscription.remove();
}
