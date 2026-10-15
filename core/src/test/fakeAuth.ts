import type {AuthClient, AuthFailure} from '../auth/authClient';

type Method =
  | 'sendVerificationOtp'
  | 'requestPasswordReset'
  | 'emailOtp.resetPassword'
  | 'signIn.emailOtp'
  | 'signIn.email'
  | 'twoFactor.verifyTotp'
  | 'twoFactor.verifyBackupCode'
  | 'twoFactor.enable'
  | 'changePassword';

// What a method answers next: data, a refusal, or a network failure.
export type FakeAnswer = {data: object} | AuthFailure | 'network';

// Better Auth's client as the flows see it: it records what was asked
// and answers with what the test told it, or an empty success.
export function fakeAuth() {
  const calls: {name: Method; body: unknown}[] = [];
  const answers = new Map<Method, FakeAnswer[]>();

  function method(name: Method) {
    return async (body: unknown) => {
      calls.push({name, body});
      const next = answers.get(name)?.shift() ?? {data: {}};

      if (next === 'network') {
        throw new TypeError('Failed to fetch');
      }

      return 'data' in next
        ? {data: next.data as never, error: null}
        : {data: null, error: next};
    };
  }

  const auth: AuthClient = {
    emailOtp: {
      sendVerificationOtp: method('sendVerificationOtp'),
      requestPasswordReset: method('requestPasswordReset'),
      resetPassword: method('emailOtp.resetPassword'),
    },
    signIn: {
      emailOtp: method('signIn.emailOtp'),
      email: method('signIn.email'),
    },
    twoFactor: {
      verifyTotp: method('twoFactor.verifyTotp'),
      verifyBackupCode: method('twoFactor.verifyBackupCode'),
      enable: method('twoFactor.enable'),
    },
    changePassword: method('changePassword'),
  };

  return {
    auth,
    calls,
    answer(name: Method, next: FakeAnswer) {
      answers.set(name, [...(answers.get(name) ?? []), next]);
    },
  };
}
