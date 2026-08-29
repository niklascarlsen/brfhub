import createClient from 'openapi-fetch';

import {apiError} from '@/api/errors';
import type {components, paths} from '@/generated/api';

export type Booking = components['schemas']['Booking'];
export type Slot = components['schemas']['Slot'];
export type BookingWindow = components['schemas']['BookingWindow'];
export type Subscription = components['schemas']['Subscription'];

const CURRENT_APARTMENT_NUMBER = '12';
const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(input: Request): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  return fetch(input, {signal: controller.signal}).finally(() => {
    clearTimeout(timer);
  });
}

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
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
