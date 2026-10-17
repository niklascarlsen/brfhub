import {errorMessage} from '../api/errors';
import {limits} from '../generated/limits';
import type {Messages} from '../i18n/catalog';
import type {AuthFailure} from './authClient';

// What Better Auth's refusals mean to the one signing in, setting up the
// authenticator or changing the password. Each flow names its own codes,
// and they share what any of them can be told: the network failed, the
// rate limiter or the origin check refused, the server failed, or
// something else went wrong.

function commonFailure(failure: AuthFailure, t: Messages): string {
  switch (failure.status) {
    case 429:
      return t.login.tooManyAttempts;
    case 403:
      return t.login.originRefused;
  }

  return errorMessage(failure.status >= 500 ? 'SERVER_ERROR' : 'UNKNOWN', t);
}

// A new password breaks the server's rules.
function passwordRuleFailure(failure: AuthFailure, t: Messages) {
  const {minLength, maxLength} = limits.ChangePasswordBody.newPassword;

  switch (failure.code) {
    case 'PASSWORD_TOO_SHORT':
      return t.admin.organization.passwordTooShort(minLength);
    case 'PASSWORD_TOO_LONG':
      return t.admin.organization.passwordTooLong(maxLength);
    default:
      return null;
  }
}

function failureOf(
  failure: AuthFailure | null,
  t: Messages,
  named: (failure: AuthFailure) => string | null,
): string {
  if (failure === null) {
    return errorMessage('NETWORK', t);
  }

  return named(failure) ?? commonFailure(failure, t);
}

// A code mailed to sign in or to set the password was asked for too soon
// after the last, which still holds: the seconds until another may be.
export function recentlySent(failure: AuthFailure | null): number | null {
  return failure?.code === 'CODE_RECENTLY_SENT'
    ? (failure.retryAfter ?? limits.MailedCode.resendSeconds)
    : null;
}

// A code mailed to sign in or to set the password.
export function codeFailure(failure: AuthFailure | null, t: Messages) {
  return failureOf(failure, t, ({code, retryAfter}) => {
    switch (code) {
      case 'INVALID_OTP':
        return t.login.wrongCode;
      case 'OTP_EXPIRED':
        return t.login.codeExpired;
      case 'TOO_MANY_ATTEMPTS':
        return t.login.tooManyCodeAttempts;
      case 'TOO_MANY_CODES':
        return t.login.tooManyCodes(retryAfter ?? 60 * 60);
      default:
        return null;
    }
  });
}

export function credentialsFailure(failure: AuthFailure | null, t: Messages) {
  return failureOf(failure, t, ({status}) =>
    status === 401 ? t.login.wrongCredentials : null,
  );
}

// A stale challenge comes from a sign-in started more than ten minutes
// ago.
export function isStaleChallenge(failure: AuthFailure | null): boolean {
  return failure?.code === 'INVALID_TWO_FACTOR_COOKIE';
}

// The authenticator's code or a backup code, when signing in.
export function totpFailure(failure: AuthFailure | null, t: Messages) {
  return failureOf(failure, t, (named) => {
    if (isStaleChallenge(named)) {
      return t.login.startOver;
    }

    switch (named.code) {
      case 'INVALID_CODE':
      case 'INVALID_BACKUP_CODE':
        return t.twoFactor.wrongCode;
      case 'ACCOUNT_TEMPORARILY_LOCKED':
        return t.twoFactor.locked;
      default:
        return null;
    }
  });
}

// Setting the password with a mailed code: the code or the password can
// be refused.
export function resetFailure(failure: AuthFailure | null, t: Messages) {
  return (
    (failure && passwordRuleFailure(failure, t)) ?? codeFailure(failure, t)
  );
}

// The password, when starting to set the authenticator up.
export function enableFailure(failure: AuthFailure | null, t: Messages) {
  return failureOf(failure, t, ({code}) => {
    switch (code) {
      case 'INVALID_PASSWORD':
        return t.twoFactor.wrongPassword;
      case 'TOTP_ALREADY_ENABLED':
        return t.twoFactor.alreadyEnabled;
      default:
        return null;
    }
  });
}

// The authenticator's first code, when setting it up.
export function verifyFailure(failure: AuthFailure | null, t: Messages) {
  return failureOf(failure, t, ({code}) => {
    switch (code) {
      case 'INVALID_CODE':
        return t.twoFactor.wrongCode;
      case 'ACCOUNT_TEMPORARILY_LOCKED':
        return t.twoFactor.locked;
      default:
        return null;
    }
  });
}

// A signed-in admin changing the password.
export function changeFailure(failure: AuthFailure | null, t: Messages) {
  return failureOf(failure, t, (named) =>
    named.code === 'INVALID_PASSWORD'
      ? t.admin.organization.wrongPassword
      : passwordRuleFailure(named, t),
  );
}
