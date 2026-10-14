import {z} from 'zod';

import {localeSchema} from '../lib/locale.js';

// An Expo token names the phone, a web subscription the browser: its
// endpoint at the push service and the keys that encrypt for it, as
// web/src/lib/push.ts writes them. Anything else is stored for nothing
// and would only be sent to the push service to be refused.
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[\w-]+\]$/;

function isWebSubscription(token: string): boolean {
  if (!token.startsWith('{')) {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(token);

    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }

    const {endpoint, keys} = parsed as {endpoint?: unknown; keys?: unknown};

    return (
      typeof endpoint === 'string' &&
      endpoint.startsWith('https://') &&
      typeof keys === 'object' &&
      keys !== null &&
      typeof (keys as {p256dh?: unknown}).p256dh === 'string' &&
      typeof (keys as {auth?: unknown}).auth === 'string'
    );
  } catch {
    return false;
  }
}

export function isPushToken(token: string): boolean {
  return EXPO_TOKEN.test(token) || isWebSubscription(token);
}

// The device's language comes along, so its push is written in it.
export const pushTokenBodySchema = z.object({
  token: z
    .string()
    .max(1000)
    .refine(isPushToken, {message: 'Not a push token'}),
  locale: localeSchema,
});

export const dropPushTokenBodySchema = pushTokenBodySchema.pick({token: true});

z.globalRegistry.add(pushTokenBodySchema, {id: 'PushTokenBody'});
z.globalRegistry.add(dropPushTokenBodySchema, {id: 'DropPushTokenBody'});
