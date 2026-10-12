import {apiError} from '@booking/core/api/errors';
import type {components, paths} from '@booking/core/generated/api';
import createClient from 'openapi-fetch';

import {API_BASE_URL} from '@/api/baseUrl';
import {authClient, sessionChanged} from '@/auth/client';
import {getRequestLocale} from '@/lib/locale';

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: Request): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return fetch(input, {signal: controller.signal}).finally(() => {
    clearTimeout(timer);
  });
}

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  // The session cookie lives in SecureStore, not the platform cookie jar.
  credentials: 'omit',
  fetch: fetchWithTimeout,
});

// The server answers with the organization's text in this language.
api.use({
  async onRequest({request}) {
    request.headers.set('cookie', await authClient.getCookie());
    request.headers.set('accept-language', getRequestLocale());
  },
});

type ParsedError = Partial<components['schemas']['Error']>;

export async function unwrap<T>(
  request: Promise<{
    data?: T;
    error?: ParsedError;
    response: Response;
  }>,
): Promise<T> {
  const result = await request.catch((error: unknown) => {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw apiError(aborted ? 'TIMEOUT' : 'NETWORK');
  });

  if (!result.response.ok || result.error !== undefined) {
    if (result.response.status >= 500) {
      throw apiError('SERVER_ERROR');
    }
    if (result.response.status === 401) {
      sessionChanged();
    }
    throw apiError(result.error?.code ?? 'UNKNOWN');
  }

  return result.data as T;
}
