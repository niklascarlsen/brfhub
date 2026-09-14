import {expoClient} from '@better-auth/expo/client';
import {createAuthClient} from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import {API_BASE_URL} from '@/api/baseUrl';

export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/auth`,
  plugins: [
    expoClient({
      scheme: 'bookslot',
      storagePrefix: 'booking',
      storage: SecureStore,
    }),
  ],
});

// Makes useSession refetch, so a session the server no longer accepts
// drops the app back to the login screen.
export function sessionChanged(): void {
  authClient.$store.notify('$sessionSignal');
}
