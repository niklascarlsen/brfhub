import createClient from 'openapi-fetch';

import {apiError} from '@/api/errors';
import type {components, paths} from '@/generated/api';

export type Booking = components['schemas']['Booking'];
export type Slot = components['schemas']['Slot'];
export type BookingWindow = components['schemas']['BookingWindow'];
export type Resource = components['schemas']['Resource'];
export type ActiveBooking = NonNullable<
  components['schemas']['Slots']['active']
>;

export const CURRENT_APARTMENT_NUMBER = '12';
const TIMEOUT_MS = 10_000;

function apiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL;

  if (!configured) {
    if (!import.meta.env.DEV) {
      throw new Error('VITE_API_URL is required in production');
    }

    const url = new URL('http://localhost:3000');
    url.hostname = window.location.hostname;
    return url.href.replace(/\/$/, '');
  }

  const url = new URL(configured, window.location.origin);

  if (
    import.meta.env.DEV &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  ) {
    url.hostname = window.location.hostname;
  }

  return url.href.replace(/\/$/, '');
}

async function fetchWithTimeout(input: Request): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return fetch(input, {signal: controller.signal}).finally(() => {
    clearTimeout(timer);
  });
}

export const api = createClient<paths>({
  baseUrl: apiBaseUrl(),
  headers: {
    'x-apartment-number': CURRENT_APARTMENT_NUMBER,
  },
  fetch: fetchWithTimeout,
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
    throw apiError(result.error?.code ?? 'UNKNOWN');
  }

  return result.data as T;
}
