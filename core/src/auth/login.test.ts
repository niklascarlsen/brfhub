import {describe, expect, test} from 'vitest';

import {sv} from '../i18n/sv';
import {
  codeFailure,
  isStaleChallenge,
  passwordFailure,
  resetFailure,
  totpFailure,
} from './login';

describe('codeFailure', () => {
  test('names what is wrong with the code', () => {
    expect(codeFailure({status: 400, code: 'INVALID_OTP'}, sv)).toBe(
      sv.login.wrongCode,
    );
    expect(codeFailure({status: 400, code: 'OTP_EXPIRED'}, sv)).toBe(
      sv.login.codeExpired,
    );
    expect(codeFailure({status: 400, code: 'TOO_MANY_ATTEMPTS'}, sv)).toBe(
      sv.login.tooManyCodeAttempts,
    );
  });

  test('tells a rate limit and a refused origin apart from the network', () => {
    expect(codeFailure({status: 429}, sv)).toBe(sv.login.tooManyAttempts);
    expect(codeFailure({status: 403}, sv)).toBe(sv.login.originRefused);
    expect(codeFailure({status: 500}, sv)).toBe(sv.errors.NETWORK);
    expect(codeFailure(null, sv)).toBe(sv.errors.NETWORK);
  });
});

describe('passwordFailure', () => {
  test('a refused password is wrong credentials', () => {
    expect(passwordFailure({status: 401}, sv)).toBe(sv.login.wrongCredentials);
    expect(passwordFailure({status: 429}, sv)).toBe(sv.login.tooManyAttempts);
    expect(passwordFailure(null, sv)).toBe(sv.errors.NETWORK);
  });
});

describe('totpFailure', () => {
  test('names a wrong code, a lockout and a stale challenge', () => {
    expect(totpFailure({status: 401, code: 'INVALID_CODE'}, sv)).toBe(
      sv.twoFactor.wrongCode,
    );
    expect(totpFailure({status: 401, code: 'INVALID_BACKUP_CODE'}, sv)).toBe(
      sv.twoFactor.wrongCode,
    );
    expect(
      totpFailure({status: 429, code: 'ACCOUNT_TEMPORARILY_LOCKED'}, sv),
    ).toBe(sv.twoFactor.locked);
    expect(
      isStaleChallenge({status: 401, code: 'INVALID_TWO_FACTOR_COOKIE'}),
    ).toBe(true);
    expect(isStaleChallenge({status: 401, code: 'INVALID_CODE'})).toBe(false);
  });
});

describe('resetFailure', () => {
  test('tells a bad password apart from a bad code', () => {
    const limits = {minLength: 8, maxLength: 128};
    expect(
      resetFailure({status: 400, code: 'PASSWORD_TOO_SHORT'}, sv, limits),
    ).toBe(sv.admin.organization.passwordTooShort(8));
    expect(resetFailure({status: 400, code: 'INVALID_OTP'}, sv, limits)).toBe(
      sv.login.wrongCode,
    );
  });
});
