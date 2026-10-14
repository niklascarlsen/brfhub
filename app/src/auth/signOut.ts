import {storageAdapter} from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

import {authClient, COOKIE_STORE_KEY} from '@/auth/client';
import {dropPushToken} from '@/push';

// The same storage expoClient is given, so reads and writes queue with its
// own.
const cookies = storageAdapter(SecureStore);

// A device the admin chose to trust keeps skipping the authenticator's
// code for its month after signing out, as a browser does. expoClient
// empties every cookie at sign-out, so that one is put back.
async function trustedDevice(): Promise<string | null> {
  const stored = JSON.parse(
    (await cookies.getItemAsync(COOKIE_STORE_KEY)) ?? '{}',
  ) as Record<string, unknown>;
  const kept = Object.fromEntries(
    Object.entries(stored).filter(([name]) => name.endsWith('trust_device')),
  );

  return Object.keys(kept).length > 0 ? JSON.stringify(kept) : null;
}

// The push token goes first, while the session can still vouch for it.
// Failing to drop it must not keep anyone signed in.
export async function signOut(): Promise<void> {
  await dropPushToken().catch((error: unknown) => {
    console.warn('[push] could not drop push token', error);
  });
  const trusted = await trustedDevice().catch(() => null);
  await authClient.signOut();

  if (trusted !== null) {
    await cookies.setItemAsync(COOKIE_STORE_KEY, trusted);
  }
}
