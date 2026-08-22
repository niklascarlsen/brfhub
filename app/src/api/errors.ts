import type {components} from '@/generated/api';

export type ClientErrorCode =
  components['schemas']['Error']['code'] | 'NETWORK';

const MESSAGES: Record<ClientErrorCode, string> = {
  HAS_ACTIVE_BOOKING: 'Du har redan en bokning',
  SLOT_TAKEN: 'Tiden är redan bokad',
  SLOT_IN_PAST: 'Tiden har redan passerat',
  OUTSIDE_BOOKING_WINDOW: 'Den dagen går inte att boka än',
  NOT_FOUND: 'Hittades inte',
  FORBIDDEN: 'Det där är inte din bokning',
  VALIDATION: 'Ogiltig förfrågan',
  NETWORK: 'Kunde inte nå servern',
  UNKNOWN: 'Försök igen.',
};

export function errorMessage(code: ClientErrorCode): string {
  return MESSAGES[code] ?? MESSAGES.UNKNOWN;
}

export class ApiError extends Error {
  readonly code: ClientErrorCode;

  constructor(code: ClientErrorCode) {
    super(errorMessage(code));
    this.name = 'ApiError';
    this.code = code;
  }
}
