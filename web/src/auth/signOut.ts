import {authClient} from '@/auth/client';
import {dropPushSubscription} from '@/lib/push';

// The push subscription goes first, while the session can still vouch
// for it. Failing to drop it must not keep anyone signed in.
export async function signOut(): Promise<void> {
  await dropPushSubscription().catch((error: unknown) => {
    console.warn('[push] could not drop subscription', error);
  });
  await authClient.signOut();
}
