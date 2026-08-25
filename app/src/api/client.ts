import createClient from 'openapi-fetch';

import {apiError} from '@/api/errors';
import type {components, paths} from '@/generated/api';

export type Booking = components['schemas']['Booking'];
export type Slot = components['schemas']['Slot'];
export type BookingWindow = components['schemas']['BookingWindow'];
export type Subscription = components['schemas']['Subscription'];

const CURRENT_APARTMENT_NUMBER = '12';

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  headers: {
    'x-apartment-number': CURRENT_APARTMENT_NUMBER,
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
  const result = await request.catch(() => {
    throw apiError('NETWORK');
  });

  if (!result.response.ok || result.error !== undefined) {
    throw apiError(result.error?.code ?? 'UNKNOWN');
  }

  return result.data as T;
}
