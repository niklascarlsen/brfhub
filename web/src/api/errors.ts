import type {components} from '@/generated/api';
import type {Messages} from '@/i18n/catalog';

export type ClientErrorCode =
  | components['schemas']['Error']['code']
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

// Every code the client can show, so an unknown one from the server
// becomes UNKNOWN. The words are in the message catalog.
const KNOWN: Record<ClientErrorCode, true> = {
  HAS_ACTIVE_BOOKING: true,
  SLOT_TAKEN: true,
  SLOT_IN_PAST: true,
  SLOT_STARTED: true,
  OUTSIDE_BOOKING_WINDOW: true,
  SLOT_AVAILABLE: true,
  APARTMENT_TAKEN: true,
  EMAIL_TAKEN: true,
  CHANGE_INSIDE_WINDOW: true,
  ENDS_IN_PAST: true,
  INVALID_SCHEDULE: true,
  KIND_IN_USE: true,
  NOT_FOUND: true,
  UNAUTHORIZED: true,
  FORBIDDEN: true,
  VALIDATION: true,
  NETWORK: true,
  TIMEOUT: true,
  SERVER_ERROR: true,
  UNKNOWN: true,
};

export function errorMessage(code: ClientErrorCode, t: Messages): string {
  return t.errors[code];
}

type ApiError = Error & {code: ClientErrorCode};

export function apiError(code: string): ApiError {
  const known: ClientErrorCode =
    code in KNOWN ? (code as ClientErrorCode) : 'UNKNOWN';

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
    error.code in KNOWN
  );
}

export function codeOf(error: unknown): ClientErrorCode {
  return isApiError(error) ? error.code : 'UNKNOWN';
}
