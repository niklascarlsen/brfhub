import type {components} from '@/generated/api';

export type ClientErrorCode =
  | components['schemas']['Error']['code']
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

const MESSAGES: Record<ClientErrorCode, string> = {
  HAS_ACTIVE_BOOKING: 'Du har redan en bokning',
  SLOT_TAKEN: 'Tiden är redan bokad',
  SLOT_IN_PAST: 'Tiden har redan passerat',
  SLOT_STARTED: 'Tiden har börjat, drop-in gäller',
  OUTSIDE_BOOKING_WINDOW: 'Den dagen går inte att boka än',
  SLOT_AVAILABLE: 'Tiden är ledig, boka den istället',
  APARTMENT_TAKEN: 'Det finns redan en lägenhet med det numret',
  EMAIL_TAKEN: 'E-postadressen används redan av ett annat konto',
  NOT_FOUND: 'Hittades inte',
  UNAUTHORIZED: 'Du är inte inloggad',
  FORBIDDEN: 'Det där är inte din bokning',
  VALIDATION: 'Ogiltig förfrågan',
  NETWORK: 'Ingen kontakt med servern',
  TIMEOUT: 'Servern svarade inte i tid, försök igen',
  SERVER_ERROR: 'Något gick fel på servern, försök om en stund',
  UNKNOWN: 'Något gick fel',
};

export function errorMessage(code: ClientErrorCode): string {
  return MESSAGES[code];
}

type ApiError = Error & {code: ClientErrorCode};

export function apiError(code: string): ApiError {
  const known: ClientErrorCode =
    code in MESSAGES ? (code as ClientErrorCode) : 'UNKNOWN';

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
    error.code in MESSAGES
  );
}

export function codeOf(error: unknown): ClientErrorCode {
  return isApiError(error) ? error.code : 'UNKNOWN';
}
