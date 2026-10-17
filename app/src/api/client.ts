import {createApi} from '@brfhub/core/api/createApi';

import {API_BASE_URL} from '@/api/baseUrl';
import {authClient, sessionChanged} from '@/auth/client';
import {getRequestLocale} from '@/lib/locale';

export const {api, unwrap} = createApi({
  baseUrl: API_BASE_URL,
  // The session cookie lives in SecureStore, not the platform cookie jar.
  credentials: 'omit',
  // The server answers with the organization's text in this language.
  headers: async () => ({
    cookie: await authClient.getCookie(),
    'accept-language': getRequestLocale(),
  }),
  onUnauthorized: sessionChanged,
});
