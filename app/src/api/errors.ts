import type {components} from '@/generated/api';
import type {Messages} from '@/i18n/catalog';
import {sv} from '@/i18n/sv';

export type ClientErrorCode =
  | components['schemas']['Error']['code']
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

export function errorMessage(code: ClientErrorCode, t: Messages): string {
  return t.errors[code];
}

type ApiError = Error & {code: ClientErrorCode};

// The catalog words every code the client knows, so a code a newer server
// sends becomes UNKNOWN.
export function apiError(code: string): ApiError {
  const known: ClientErrorCode =
    code in sv.errors ? (code as ClientErrorCode) : 'UNKNOWN';

  return Object.assign(new Error(known), {
    name: 'ApiError',
    code: known,
  });
}

function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code in sv.errors
  );
}

export function codeOf(error: unknown): ClientErrorCode {
  return isApiError(error) ? error.code : 'UNKNOWN';
}
