import {expoClient} from '@better-auth/expo/client';
import {emailOTPClient, twoFactorClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import {API_BASE_URL} from '@/api/baseUrl';
import {getRequestLocale} from '@/lib/locale';

// Where expoClient keeps the cookies, as JSON by name. Not a public API of
// @better-auth/expo: check signOut still keeps the trusted device when
// upgrading it.
const STORAGE_PREFIX = 'booking';
export const COOKIE_STORE_KEY = `${STORAGE_PREFIX}_cookie`;

export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/auth`,
  // The server mails the sign-in and password codes in this language,
  // the one the app is shown in rather than the platform's own.
  fetchOptions: {
    onRequest: (context) => {
      context.headers.set('accept-language', getRequestLocale());
      return context;
    },
  },
  plugins: [
    emailOTPClient(),
    // The login screen shows the second step itself.
    twoFactorClient({onTwoFactorRedirect: () => {}}),
    expoClient({
      scheme: 'bookslot',
      storagePrefix: STORAGE_PREFIX,
      storage: SecureStore,
    }),
  ],
});

// Makes useSession refetch, so a session the server no longer accepts
// drops the app back to the login screen.
export function sessionChanged(): void {
  authClient.$store.notify('$sessionSignal');
}
