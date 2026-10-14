import {authClient} from '@/auth/client';
import {dropPushToken} from '@/push';

// The push token goes first, while the session can still vouch for it.
// Failing to drop it must not keep anyone signed in.
export async function signOut(): Promise<void> {
  await dropPushToken().catch((error: unknown) => {
    console.warn('[push] could not drop push token', error);
  });
  await authClient.signOut();
}
