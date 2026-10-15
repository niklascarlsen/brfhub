import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {createApi} from '../api/createApi';
import {en} from '../i18n/en';
import {sv} from '../i18n/sv';
import {fakeAuth} from '../test/fakeAuth';
import {canSubmit, createSignIn, initialSignIn, resetProblem} from './signIn';

const t = sv;
const RESIDENT = '12@example.com';
const ADMIN = 'admin@example.com';
const NEW_PASSWORD = 'a new password';

// What the server answers /sign-in/method with next.
let method: {status: number; body: unknown} = {
  status: 200,
  body: {method: 'code'},
};
let asked: unknown[] = [];

beforeEach(() => {
  method = {status: 200, body: {method: 'code'}};
  asked = [];

  vi.stubGlobal('fetch', async (request: Request) => {
    asked.push(await request.json());
    return Response.json(method.body, {status: method.status});
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function answersWith(name: 'code' | 'password' | 'set-password') {
  method = {status: 200, body: {method: name}};
}

function start({
  email = '',
  password = '',
  devCodes = {},
}: {
  email?: string;
  password?: string;
  devCodes?: {mailed?: string; totp?: string};
} = {}) {
  const fake = fakeAuth();
  const {api, unwrap} = createApi({
    baseUrl: 'http://localhost',
    credentials: 'omit',
    headers: () => ({}),
    onUnauthorized: () => {},
  });
  let state = initialSignIn({email, password});
  const signIn = createSignIn(
    {
      api,
      unwrap,
      auth: fake.auth,
      t,
      devCode: async (_email, kind) => devCodes[kind] ?? '',
    },
    state,
    (next) => {
      state = next;
    },
  );

  return {...fake, signIn, state: () => state};
}

// Types the address and continues, as the email step does.
async function atStep(
  name: 'code' | 'password' | 'set-password',
  options: Parameters<typeof start>[0] = {},
) {
  answersWith(name);
  const flow = start({
    email: name === 'code' ? RESIDENT : ADMIN,
    ...options,
  });
  await flow.signIn.submit();
  flow.calls.length = 0;
  return flow;
}

describe('the address', () => {
  test('mails an apartment its code, trimmed as the server trims it', async () => {
    answersWith('code');
    const {signIn, state, calls} = start({email: `  ${RESIDENT} `});

    await signIn.submit();

    expect(asked).toEqual([{email: RESIDENT}]);
    expect(calls).toEqual([
      {name: 'sendVerificationOtp', body: {email: RESIDENT, type: 'sign-in'}},
    ]);
    expect(state().step).toEqual({kind: 'code', email: RESIDENT});
    expect(state().submitting).toBe(false);
  });

  test('asks an admin for the password and mails nothing', async () => {
    answersWith('password');
    const {signIn, state, calls} = start({email: ADMIN});

    await signIn.submit();

    expect(calls).toEqual([]);
    expect(state().step).toEqual({kind: 'password', email: ADMIN});
  });

  test('mails an admin without a password a code to choose one', async () => {
    answersWith('set-password');
    const {signIn, state, calls} = start({email: ADMIN});

    await signIn.submit();

    expect(calls).toEqual([
      {name: 'requestPasswordReset', body: {email: ADMIN}},
    ]);
    expect(state().step).toEqual({kind: 'reset', email: ADMIN});
  });

  test('stays when the server refuses or the code is not sent', async () => {
    method = {status: 500, body: {code: 'UNKNOWN', message: ''}};
    const refused = start({email: ADMIN});
    await refused.signIn.submit();
    expect(refused.state().step).toEqual({kind: 'email'});
    expect(refused.state().error).toBe(t.errors.SERVER_ERROR);

    answersWith('code');
    const unsent = start({email: RESIDENT});
    unsent.answer('sendVerificationOtp', {status: 429});
    await unsent.signIn.submit();
    expect(unsent.state().step).toEqual({kind: 'email'});
    expect(unsent.state().error).toBe(t.login.tooManyAttempts);
  });

  test('stays on the address when the reset code is not sent', async () => {
    answersWith('set-password');
    const {signIn, state, answer} = start({email: ADMIN});
    answer('requestPasswordReset', 'network');

    await signIn.submit();

    expect(state().step).toEqual({kind: 'email'});
    expect(state().error).toBe(t.errors.NETWORK);
  });

  test('cannot be sent empty', async () => {
    const {signIn, state} = start({email: '   '});

    expect(canSubmit(state())).toBe(false);
    await signIn.submit();
    expect(asked).toEqual([]);
  });
});

describe('the mailed code', () => {
  test('signs the apartment in with the code it typed', async () => {
    const {signIn, state, calls} = await atStep('code');

    signIn.edit({code: ' 123456 '});
    await signIn.submit();

    expect(calls).toEqual([
      {name: 'signIn.emailOtp', body: {email: RESIDENT, otp: '123456'}},
    ]);
    expect(state().error).toBeNull();
  });

  test('names what is wrong with it', async () => {
    const cases = [
      [{status: 400, code: 'INVALID_OTP'}, t.login.wrongCode],
      [{status: 400, code: 'OTP_EXPIRED'}, t.login.codeExpired],
      [{status: 403, code: 'TOO_MANY_ATTEMPTS'}, t.login.tooManyCodeAttempts],
      [{status: 429}, t.login.tooManyAttempts],
      [{status: 403}, t.login.originRefused],
      [{status: 500}, t.errors.SERVER_ERROR],
      [{status: 400}, t.errors.UNKNOWN],
      ['network', t.errors.NETWORK],
    ] as const;

    for (const [failure, message] of cases) {
      const {signIn, state, answer} = await atStep('code');
      answer('signIn.emailOtp', failure);
      signIn.edit({code: '000000'});
      await signIn.submit();

      expect(state().error).toBe(message);
      expect(state().step.kind).toBe('code');
    }
  });

  test('a new one empties the field and says it was sent', async () => {
    const {signIn, state, calls} = await atStep('code');
    signIn.edit({code: '111111'});

    await signIn.resendCode();

    expect(calls).toEqual([
      {name: 'sendVerificationOtp', body: {email: RESIDENT, type: 'sign-in'}},
    ]);
    expect(state().fields.code).toBe('');
    expect(state().notice).toBe(t.login.codeSent);
  });

  test('a new one that is not sent leaves the code and says why', async () => {
    const {signIn, state, answer} = await atStep('code');
    signIn.edit({code: '111111'});
    answer('sendVerificationOtp', {status: 429});

    await signIn.resendCode();

    expect(state().fields.code).toBe('111111');
    expect(state().notice).toBeNull();
    expect(state().error).toBe(t.login.tooManyAttempts);
  });

  test('is filled in where dev tells it', async () => {
    const {state} = await atStep('code', {devCodes: {mailed: '123456'}});

    expect(state().fields.code).toBe('123456');
  });
});

describe('the password', () => {
  test('goes on to the authenticator when the server asks for it', async () => {
    const {signIn, state, calls, answer} = await atStep('password', {
      password: 'password',
      devCodes: {totp: '654321'},
    });
    answer('signIn.email', {data: {twoFactorRedirect: true}});

    await signIn.submit();

    expect(calls).toEqual([
      {name: 'signIn.email', body: {email: ADMIN, password: 'password'}},
    ]);
    expect(state().step).toEqual({kind: 'totp', email: ADMIN, backup: false});
    expect(state().fields.code).toBe('654321');
  });

  test('signs a trusted device in at once', async () => {
    const {signIn, state} = await atStep('password', {password: 'password'});

    await signIn.submit();

    expect(state().step.kind).toBe('password');
    expect(state().error).toBeNull();
  });

  test('a refused one is wrong credentials', async () => {
    const {signIn, state, answer} = await atStep('password', {
      password: 'wrong',
    });
    answer('signIn.email', {status: 401, code: 'INVALID_EMAIL_OR_PASSWORD'});

    await signIn.submit();

    expect(state().error).toBe(t.login.wrongCredentials);
  });

  test('tells a rate limit and the network apart from wrong credentials', async () => {
    const cases = [
      [{status: 429}, t.login.tooManyAttempts],
      ['network', t.errors.NETWORK],
    ] as const;

    for (const [failure, message] of cases) {
      const {signIn, state, answer} = await atStep('password', {
        password: 'password',
      });
      answer('signIn.email', failure);
      await signIn.submit();

      expect(state().error).toBe(message);
      expect(state().step.kind).toBe('password');
    }
  });

  test('cannot be sent empty', async () => {
    const {state} = await atStep('password');

    expect(canSubmit(state())).toBe(false);
  });
});

describe('the authenticator', () => {
  async function atTotp() {
    const flow = await atStep('password', {password: 'password'});
    flow.answer('signIn.email', {data: {twoFactorRedirect: true}});
    await flow.signIn.submit();
    flow.calls.length = 0;
    return flow;
  }

  test('sends the code and whether to trust the device', async () => {
    const {signIn, calls} = await atTotp();

    signIn.edit({code: ' 123456 ', trustDevice: false});
    await signIn.submit();

    expect(calls).toEqual([
      {
        name: 'twoFactor.verifyTotp',
        body: {code: '123456', trustDevice: false},
      },
    ]);
  });

  test('takes a backup code instead, with the field emptied', async () => {
    const {signIn, state, calls} = await atTotp();
    signIn.edit({code: '123456'});

    signIn.toggleBackup();
    expect(state().step).toEqual({kind: 'totp', email: ADMIN, backup: true});
    expect(state().fields.code).toBe('');

    signIn.edit({code: 'abcde-fghij'});
    await signIn.submit();

    expect(calls).toEqual([
      {
        name: 'twoFactor.verifyBackupCode',
        body: {code: 'abcde-fghij', trustDevice: true},
      },
    ]);
  });

  test('names a wrong code and a lockout', async () => {
    const cases = [
      [{status: 401, code: 'INVALID_CODE'}, t.twoFactor.wrongCode],
      [{status: 429, code: 'ACCOUNT_TEMPORARILY_LOCKED'}, t.twoFactor.locked],
      [{status: 429}, t.login.tooManyAttempts],
      ['network', t.errors.NETWORK],
    ] as const;

    for (const [failure, message] of cases) {
      const {signIn, state, answer} = await atTotp();
      answer('twoFactor.verifyTotp', failure);
      signIn.edit({code: '000000'});
      await signIn.submit();

      expect(state().error).toBe(message);
      expect(state().step.kind).toBe('totp');
    }
  });

  test('a stale challenge goes back to the password', async () => {
    const {signIn, state, answer} = await atTotp();
    answer('twoFactor.verifyTotp', {
      status: 401,
      code: 'INVALID_TWO_FACTOR_COOKIE',
    });
    signIn.edit({code: '123456'});

    await signIn.submit();

    expect(state().step).toEqual({kind: 'password', email: ADMIN});
    expect(state().error).toBe(t.login.startOver);
  });
});

describe('setting the password with a mailed code', () => {
  test('signs in with the new password, on to the authenticator', async () => {
    const {signIn, state, calls, answer} = await atStep('set-password');
    answer('signIn.email', {data: {twoFactorRedirect: true}});

    signIn.editReset('code', ' 123456 ');
    signIn.editReset('next', NEW_PASSWORD);
    signIn.editReset('repeat', NEW_PASSWORD);
    await signIn.submit();

    expect(calls).toEqual([
      {
        name: 'emailOtp.resetPassword',
        body: {email: ADMIN, otp: '123456', password: NEW_PASSWORD},
      },
      {name: 'signIn.email', body: {email: ADMIN, password: NEW_PASSWORD}},
    ]);
    expect(state().step).toEqual({kind: 'totp', email: ADMIN, backup: false});
    expect(state().fields.password).toBe(NEW_PASSWORD);
  });

  test('shows what is wrong instead of sending', async () => {
    const {signIn, state, calls} = await atStep('set-password');

    expect(resetProblem(state(), 'next', t)).toBeNull();
    await signIn.submit();

    expect(calls).toEqual([]);
    expect(resetProblem(state(), 'code', t)).toBe(t.admin.field.required);
    expect(resetProblem(state(), 'next', t)).toBe(
      t.admin.organization.passwordTooShort(8),
    );
  });

  test('marks a field once it is left in a changed form', async () => {
    const {signIn, state} = await atStep('set-password');

    signIn.editReset('next', 'short');
    signIn.leaveReset('next');

    expect(resetProblem(state(), 'next', t)).toBe(
      t.admin.organization.passwordTooShort(8),
    );
    expect(resetProblem(state(), 'repeat', t)).toBeNull();
  });

  test('tells a bad code apart from a bad password', async () => {
    const cases = [
      [{status: 400, code: 'INVALID_OTP'}, t.login.wrongCode],
      [
        {status: 400, code: 'PASSWORD_TOO_SHORT'},
        t.admin.organization.passwordTooShort(8),
      ],
    ] as const;

    for (const [failure, message] of cases) {
      const {signIn, state, answer} = await atStep('set-password');
      answer('emailOtp.resetPassword', failure);
      signIn.editReset('code', '123456');
      signIn.editReset('next', NEW_PASSWORD);
      signIn.editReset('repeat', NEW_PASSWORD);
      await signIn.submit();

      expect(state().error).toBe(message);
      expect(state().step.kind).toBe('reset');
    }
  });

  test('can be started from the password step', async () => {
    const {signIn, state, calls} = await atStep('password', {
      devCodes: {mailed: '123456'},
    });

    await signIn.startReset();

    expect(calls).toEqual([
      {name: 'requestPasswordReset', body: {email: ADMIN}},
    ]);
    expect(state().step).toEqual({kind: 'reset', email: ADMIN});
    expect(state().fields.reset.code).toBe('123456');
  });
});

describe('the steps between', () => {
  test('back to the address forgets the failure and the notice', async () => {
    const {signIn, state, answer} = await atStep('code');
    answer('signIn.emailOtp', {status: 400, code: 'INVALID_OTP'});
    signIn.edit({code: '000000'});
    await signIn.submit();

    signIn.backToEmail();

    expect(state().step).toEqual({kind: 'email'});
    expect(state().error).toBeNull();
    expect(state().notice).toBeNull();
    expect(state().fields.email).toBe(RESIDENT);
  });

  test('a second press while one is on its way sends nothing', async () => {
    const {signIn, calls, state} = await atStep('code');
    signIn.edit({code: '123456'});

    const first = signIn.submit();
    expect(state().submitting).toBe(true);
    expect(canSubmit(state())).toBe(false);
    await signIn.submit();
    await signIn.resendCode();
    await first;

    expect(calls.map(({name}) => name)).toEqual(['signIn.emailOtp']);
  });

  test('a failure is told in the language picked meanwhile', async () => {
    const {signIn, state, answer, auth} = await atStep('code');
    answer('signIn.emailOtp', {status: 400, code: 'INVALID_OTP'});
    const {api, unwrap} = createApi({
      baseUrl: 'http://localhost',
      credentials: 'omit',
      headers: () => ({}),
      onUnauthorized: () => {},
    });

    signIn.use({api, unwrap, auth, t: en, devCode: async () => ''});
    signIn.edit({code: '000000'});
    await signIn.submit();

    expect(state().error).toBe(en.login.wrongCode);
  });
});
