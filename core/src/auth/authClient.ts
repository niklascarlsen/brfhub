// What Better Auth answers with when it refuses. The rate limiter answers
// 429 without a code, so status is what tells that case apart. A code
// asked for too soon after the last is told in how many seconds it may be.
export type AuthFailure = {status: number; code?: string; retryAfter?: number};

type Answer<T> = Promise<
  {data: T; error: null} | {data: null; error: AuthFailure}
>;

// The part of each client's Better Auth client that signing in, setting
// up the authenticator and changing the password use. Each client passes
// its own, and the tests a fake.
export type AuthClient = {
  emailOtp: {
    sendVerificationOtp(body: {
      email: string;
      type: 'sign-in';
    }): Answer<unknown>;
    requestPasswordReset(body: {email: string}): Answer<unknown>;
    resetPassword(body: {
      email: string;
      otp: string;
      password: string;
    }): Answer<unknown>;
  };
  signIn: {
    emailOtp(body: {email: string; otp: string}): Answer<unknown>;
    // An admin with an authenticator is answered with twoFactorRedirect.
    email(body: {email: string; password: string}): Answer<object>;
  };
  twoFactor: {
    verifyTotp(body: {code: string; trustDevice?: boolean}): Answer<unknown>;
    verifyBackupCode(body: {
      code: string;
      trustDevice?: boolean;
    }): Answer<unknown>;
    enable(body: {password: string}): Answer<
      // The plugin can also mail codes, which this server never asks for.
      {method?: string; totpURI?: string; backupCodes?: string[]}
    >;
  };
  changePassword(body: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions: boolean;
  }): Answer<unknown>;
};

export type Outcome<T> =
  {ok: true; data: T} | {ok: false; failure: AuthFailure | null};

// Better Auth throws rather than answers when the network fails, which
// is a failure of its own: null.
export async function ask<T>(answer: Answer<T>): Promise<Outcome<T>> {
  try {
    const result = await answer;
    return result.error
      ? {ok: false, failure: result.error}
      : {ok: true, data: result.data as T};
  } catch {
    return {ok: false, failure: null};
  }
}
