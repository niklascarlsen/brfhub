import {describe, expect, test, vi} from 'vitest';

import {sv as t} from '../i18n/sv';
import {fakeAuth} from '../test/fakeAuth';
import {
  canSubmitSetup,
  createTwoFactorSetup,
  initialSetup,
} from './twoFactorSetup';

const ADMIN = 'admin@example.com';
const URI =
  'otpauth://totp/BrfHub:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=BrfHub';
const BACKUP_CODES = ['abcde-fghij', 'klmno-pqrst'];

function start({password = 'password', totp = ''} = {}) {
  const fake = fakeAuth();
  const onDone = vi.fn();
  let state = initialSetup(password);
  const setup = createTwoFactorSetup(
    {
      auth: fake.auth,
      t,
      devCode: async (_email, kind) => (kind === 'totp' ? totp : ''),
      email: ADMIN,
      onDone,
    },
    state,
    (next) => {
      state = next;
    },
  );

  return {...fake, setup, onDone, state: () => state};
}

function enabled() {
  return {data: {method: 'totp', totpURI: URI, backupCodes: BACKUP_CODES}};
}

describe('setting up the authenticator', () => {
  test('goes from the password to scanning, and on to the backup codes', async () => {
    const {setup, state, calls, answer, onDone} = start({totp: '123456'});
    answer('twoFactor.enable', enabled());

    await setup.submit();

    expect(calls).toEqual([
      {name: 'twoFactor.enable', body: {password: 'password'}},
    ]);
    expect(state().step).toEqual({
      kind: 'scan',
      totpUri: URI,
      backupCodes: BACKUP_CODES,
    });
    expect(state().password).toBe('');
    expect(state().code).toBe('123456');

    setup.edit({code: ' 654321 '});
    await setup.submit();

    expect(calls.at(-1)).toEqual({
      name: 'twoFactor.verifyTotp',
      body: {code: '654321'},
    });
    expect(state().step).toEqual({kind: 'backup', backupCodes: BACKUP_CODES});
    expect(onDone).not.toHaveBeenCalled();

    await setup.submit();

    expect(onDone).toHaveBeenCalledOnce();
  });

  test('names a wrong password and an authenticator already set up', async () => {
    const cases = [
      [{status: 400, code: 'INVALID_PASSWORD'}, t.twoFactor.wrongPassword],
      [{status: 400, code: 'TOTP_ALREADY_ENABLED'}, t.twoFactor.alreadyEnabled],
      [{status: 429}, t.login.tooManyAttempts],
      ['network', t.errors.NETWORK],
    ] as const;

    for (const [failure, message] of cases) {
      const {setup, state, answer} = start();
      answer('twoFactor.enable', failure);
      await setup.submit();

      expect(state().error).toBe(message);
      expect(state().step.kind).toBe('password');
      expect(state().submitting).toBe(false);
    }
  });

  test('refuses codes by mail, which this server never asks for', async () => {
    const {setup, state, answer} = start();
    answer('twoFactor.enable', {data: {method: 'otp'}});

    await setup.submit();

    expect(state().step.kind).toBe('password');
    expect(state().error).toBe(t.errors.UNKNOWN);
  });

  test('names a wrong first code and stays on the scan', async () => {
    const {setup, state, answer} = start();
    answer('twoFactor.enable', enabled());
    answer('twoFactor.verifyTotp', {status: 401, code: 'INVALID_CODE'});
    await setup.submit();

    setup.edit({code: '000000'});
    await setup.submit();

    expect(state().error).toBe(t.twoFactor.wrongCode);
    expect(state().step.kind).toBe('scan');
  });

  test('cannot be sent without the password or the code', async () => {
    const {setup, state, calls, answer} = start({password: ''});

    expect(canSubmitSetup(state())).toBe(false);
    await setup.submit();
    expect(calls).toEqual([]);

    setup.edit({password: 'password'});
    answer('twoFactor.enable', enabled());
    await setup.submit();

    expect(state().step.kind).toBe('scan');
    expect(canSubmitSetup(state())).toBe(false);
  });
});
