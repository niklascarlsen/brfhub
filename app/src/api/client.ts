import createClient from 'openapi-fetch';

import {CURRENT_USER_ID} from '@/booking';
import type {paths} from '@/generated/api';

export const api = createClient<paths>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
  headers: {
    'x-user-id': CURRENT_USER_ID,
  },
});

type FetchResult<T> = {
  data?: T;
  error?: {message?: string};
  response: Response;
};

export async function readResult<T>(
  request: Promise<unknown>,
  fallback: string,
): Promise<{ok: true; data: T} | {ok: false; message: string; status: number}> {
  const result = (await request) as FetchResult<T>;

  if (!result.response.ok || result.data === undefined) {
    return {
      ok: false,
      message: result.error?.message ?? fallback,
      status: result.response.status,
    };
  }

  return {ok: true, data: result.data};
}
