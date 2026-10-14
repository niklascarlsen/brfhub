import type {Api} from '../api/createApi';
import {errorMessage} from '../api/errors';
import type {Messages} from '../i18n/catalog';

// Signing in is two steps: the address, then what the server says that
// address continues with. An apartment types the code it is mailed, an
// admin a password and then a code from their authenticator app, or a
// backup code. An admin can also set the password with a code mailed to
// them, which signs them in at once.
export type LoginStep =
  | {kind: 'email'}
  | {kind: 'code'; email: string}
  | {kind: 'password'; email: string}
  | {kind: 'totp'; email: string; backup: boolean}
  | {kind: 'reset'; email: string};

// The address is trimmed here, as the server trims it, so the next step
// sends Better Auth the same one. An admin without a password goes
// straight to choosing one, with the code the screen then asks for.
export async function nextStep(
  {api, unwrap}: Api,
  email: string,
): Promise<LoginStep> {
  const address = email.trim();
  const {method} = await unwrap(
    api.POST('/sign-in/method', {body: {email: address}}),
  );

  return {kind: method === 'set-password' ? 'reset' : method, email: address};
}

// What Better Auth answers with when a sign-in is refused. The rate limiter
// answers 429 without a code, so status is what tells that case apart.
export type AuthFailure = {status: number; code?: string};

// Better Auth throws rather than answers when the network fails, which the
// clients turn into null.
export function codeFailure(failure: AuthFailure | null, t: Messages): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  switch (failure.code) {
    case 'INVALID_OTP':
      return t.login.wrongCode;
    case 'OTP_EXPIRED':
      return t.login.codeExpired;
    case 'TOO_MANY_ATTEMPTS':
      return t.login.tooManyCodeAttempts;
  }

  return commonFailure(failure, t);
}

export function passwordFailure(
  failure: AuthFailure | null,
  t: Messages,
): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  if (failure.status === 401) {
    return t.login.wrongCredentials;
  }

  return commonFailure(failure, t);
}

function commonFailure(failure: AuthFailure, t: Messages): string {
  switch (failure.status) {
    case 429:
      return t.login.tooManyAttempts;
    case 403:
      return t.login.originRefused;
    default:
      return errorMessage('NETWORK', t);
  }
}

// The second step was refused. A stale challenge, from a sign-in started
// more than ten minutes ago, sends the admin back to the password.
export function totpFailure(failure: AuthFailure | null, t: Messages): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  switch (failure.code) {
    case 'INVALID_CODE':
    case 'INVALID_BACKUP_CODE':
      return t.twoFactor.wrongCode;
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return t.twoFactor.locked;
    case 'INVALID_TWO_FACTOR_COOKIE':
      return t.login.startOver;
  }

  return commonFailure(failure, t);
}

export function isStaleChallenge(failure: AuthFailure | null): boolean {
  return failure?.code === 'INVALID_TWO_FACTOR_COOKIE';
}

// Setting the password with a mailed code: the code or the password can
// be refused.
export function resetFailure(
  failure: AuthFailure | null,
  t: Messages,
  limits: {minLength: number; maxLength: number},
): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  switch (failure.code) {
    case 'PASSWORD_TOO_SHORT':
      return t.admin.organization.passwordTooShort(limits.minLength);
    case 'PASSWORD_TOO_LONG':
      return t.admin.organization.passwordTooLong(limits.maxLength);
  }

  return codeFailure(failure, t);
}
