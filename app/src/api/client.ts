import createClient from 'openapi-fetch';

import {API_BASE_URL} from '@/api/baseUrl';
import {apiError} from '@/api/errors';
import {authClient, sessionChanged} from '@/auth/client';
import type {components, paths} from '@/generated/api';

export type Booking = components['schemas']['Booking'];
export type Slot = components['schemas']['Slot'];
export type BookingWindow = components['schemas']['BookingWindow'];
export type Subscription = components['schemas']['Subscription'];
export type Resource = components['schemas']['Resource'];
export type Apartment = components['schemas']['Apartment'];
export type AdminResources = components['schemas']['AdminResources'];
export type AdminResource = components['schemas']['AdminResource'];
export type AdminKind = components['schemas']['AdminKind'];
export type SlotInput = components['schemas']['ScheduleSlot'];
export type Announcement = components['schemas']['Announcement'];
export type AdminAnnouncement = components['schemas']['AdminAnnouncement'];
export type ActiveBooking = NonNullable<
  components['schemas']['Slots']['active']
>;

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

api.use({
  async onRequest({request}) {
    request.headers.set('cookie', await authClient.getCookie());
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
