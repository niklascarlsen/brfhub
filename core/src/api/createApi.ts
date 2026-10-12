import createClient from 'openapi-fetch';

import type {components, paths} from '../generated/api';
import {apiError} from './errors';

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: Request): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return fetch(input, {signal: controller.signal}).finally(() => {
    clearTimeout(timer);
  });
}

type ParsedError = Partial<components['schemas']['Error']>;

type ApiOptions = {
  baseUrl: string;
  credentials: RequestInit['credentials'];
  // Set on every request, read again for each one.
  headers: () => Record<string, string> | Promise<Record<string, string>>;
  // The server no longer accepts the session.
  onUnauthorized: () => void;
};

export function createApi({
  baseUrl,
  credentials,
  headers,
  onUnauthorized,
}: ApiOptions) {
  const api = createClient<paths>({
    baseUrl,
    credentials,
    fetch: fetchWithTimeout,
  });

  api.use({
    async onRequest({request}) {
      for (const [name, value] of Object.entries(await headers())) {
        request.headers.set(name, value);
      }
    },
  });

  async function unwrap<T>(
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
        onUnauthorized();
      }
      throw apiError(result.error?.code ?? 'UNKNOWN');
    }

    return result.data as T;
  }

  return {api, unwrap};
}

export type Api = ReturnType<typeof createApi>;
