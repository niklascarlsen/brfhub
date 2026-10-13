import {describe, expect, test} from 'vitest';

import {sv} from '../i18n/sv';
import {codeFailure, passwordFailure} from './login';

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
