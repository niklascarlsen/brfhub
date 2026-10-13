import {encode} from 'uqr';

import {errorMessage} from '../api/errors';
import type {Messages} from '../i18n/catalog';
import type {AuthFailure} from './login';

// The QR code an authenticator app scans, as the cells each client draws
// in its own way: true is dark.
export type QrCode = {size: number; cells: boolean[][]};

export function qrCodeOf(text: string): QrCode {
  const {size, data} = encode(text, {border: 0});
  return {size, cells: data};
}

// The secret spelled out for an app that cannot scan, in groups of four.
export function secretOf(totpUri: string): string {
  const secret = new URL(totpUri).searchParams.get('secret') ?? '';
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

// Setting the authenticator up: the password first, then the app scans
// the code and answers with its first code, then the backup codes are
// shown once.
export type SetupStep =
  | {kind: 'password'}
  | {kind: 'scan'; totpUri: string; backupCodes: string[]}
  | {kind: 'backup'; backupCodes: string[]};

export function enableFailure(
  failure: AuthFailure | null,
  t: Messages,
): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  switch (failure.code) {
    case 'INVALID_PASSWORD':
      return t.twoFactor.wrongPassword;
    case 'TOTP_ALREADY_ENABLED':
      return t.twoFactor.alreadyEnabled;
    default:
      return errorMessage('NETWORK', t);
  }
}

export function verifyFailure(
  failure: AuthFailure | null,
  t: Messages,
): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  switch (failure.code) {
    case 'INVALID_CODE':
      return t.twoFactor.wrongCode;
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return t.twoFactor.locked;
    default:
      return errorMessage('NETWORK', t);
  }
}
