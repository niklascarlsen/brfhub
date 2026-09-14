// fix in development for enabling push notifications in macOS from the PWA and not chrome
// chrome://flags/#enable-mac-pwas-notification-attribution -> ENABLE

// Web push subscription lifecycle, the counterpart of app/src/push.ts.
// The subscription is stored on the server as a JSON string in the same
// push-tokens table as the Expo tokens, and the server tells them apart by
// the leading brace. Every app start re-sends it so a rotated subscription
// reaches the server and a stale VAPID key gets replaced.
import {api, unwrap} from '@/api/client';
import {openedSlot, type OpenedSlot} from '@/lib/route';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const PROMPT_KEY = 'push-prompt-shown';

function isSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function base64Url(key: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(key)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

// A subscription made with an old VAPID key can not be pushed to with the
// new one, so it is replaced.
function matchesServerKey(subscription: PushSubscription): boolean {
  const key = subscription.options.applicationServerKey;

  return key !== null && base64Url(key) === VAPID_PUBLIC_KEY;
}

async function subscriptionOf(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();

  if (existing && matchesServerKey(existing)) {
    return existing;
  }

  await existing?.unsubscribe();

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  });
}

function tokenOf(subscription: PushSubscription): string {
  const {endpoint, keys} = subscription.toJSON();

  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('Prenumerationen saknar nycklar');
  }

  return JSON.stringify({
    endpoint,
    keys: {p256dh: keys.p256dh, auth: keys.auth},
  });
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  await unwrap(
    api.POST('/push-tokens', {body: {token: tokenOf(subscription)}}),
  );
}

// Signing out must not leave this browser subscribed to the apartment's
// queue. Dev has no worker, so there is nothing to drop there.
export async function dropPushSubscription(): Promise<void> {
  if (!isSupported()) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();

  if (!subscription) {
    return;
  }

  await unwrap(
    api.DELETE('/push-tokens', {body: {token: tokenOf(subscription)}}),
  );
  await subscription.unsubscribe();
}

// Runs on every load. Re-sends the subscription when notifications are
// allowed and reports whether the in-app prompt should be shown.
export async function syncPushSubscription(): Promise<boolean> {
  if (!isSupported() || !VAPID_PUBLIC_KEY) {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;

  if (Notification.permission === 'granted') {
    await saveSubscription(await subscriptionOf(registration));
    return false;
  }

  return (
    Notification.permission === 'default' &&
    window.localStorage.getItem(PROMPT_KEY) === null
  );
}

export function markPushPromptShown(): void {
  window.localStorage.setItem(PROMPT_KEY, new Date().toISOString());
}

// Must be called from a click. Safari only shows the permission prompt
// inside a user gesture.
export async function enablePush(): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') {
    throw new Error('Notiser nekades');
  }

  const registration = await navigator.serviceWorker.ready;

  await saveSubscription(await subscriptionOf(registration));
}

// The service worker posts the slot url when a notification is tapped
// while a window is already open. New windows read it from the query
// instead, see startupSlot in route.ts.
export function onNotificationOpen(
  handler: (slot: OpenedSlot) => void,
): () => void {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const listener = (event: MessageEvent) => {
    const message: unknown = event.data;

    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'notification-open' &&
      'url' in message &&
      typeof message.url === 'string'
    ) {
      handler(openedSlot(message.url));
    }
  };

  navigator.serviceWorker.addEventListener('message', listener);
  // addEventListener alone leaves messages sent during load in the queue.
  navigator.serviceWorker.startMessages();

  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
