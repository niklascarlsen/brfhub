import {createApi} from '@booking/core/api/createApi';

import {apiBaseUrl} from '@/api/baseUrl';
import {sessionChanged} from '@/auth/client';
import {getRequestLocale} from '@/lib/locale';

export const {api, unwrap} = createApi({
  baseUrl: apiBaseUrl(),
  credentials: 'include',
  // The server answers with the organization's text in this language.
  headers: () => ({'accept-language': getRequestLocale()}),
  onUnauthorized: sessionChanged,
});
