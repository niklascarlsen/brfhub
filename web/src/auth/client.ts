import {emailOTPClient, twoFactorClient} from 'better-auth/client/plugins';
import {createAuthClient} from 'better-auth/react';

import {apiBaseUrl} from '@/api/baseUrl';

export const authClient = createAuthClient({
  baseURL: `${apiBaseUrl()}/auth`,
  // The login screen shows the second step itself.
  plugins: [emailOTPClient(), twoFactorClient({onTwoFactorRedirect: () => {}})],
});

// Makes useSession refetch, so a session the server no longer accepts
// drops the app back to the login screen.
export function sessionChanged(): void {
  authClient.$store.notify('$sessionSignal');
}
