import {emailOTPClient, twoFactorClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';

import {apiBaseUrl} from '@/api/baseUrl';
import {getRequestLocale} from '@/lib/locale';

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl()}/auth`,
  // The server mails the sign-in and password codes in this language,
  // the one the app is shown in rather than the platform's own.
  fetchOptions: {
    onRequest: (context) => {
      context.headers.set('accept-language', getRequestLocale());
      return context;
    },
  },
  // The login screen shows the second step itself.
  plugins: [emailOTPClient(), twoFactorClient({onTwoFactorRedirect: () => {}})],
});

// Makes useSession refetch, so a session the server no longer accepts
// drops the app back to the login screen.
export function sessionChanged(): void {
  authClient.$store.notify('$sessionSignal');
}
