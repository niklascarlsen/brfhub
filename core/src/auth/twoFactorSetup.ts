import {errorMessage} from '../api/errors';
import type {Messages} from '../i18n/catalog';
import {ask, type AuthClient} from './authClient';
import {enableFailure, verifyFailure} from './failures';
import type {DevCode} from './signIn';

// Setting the authenticator up: the password first, then the app scans
// the code and answers with its first code, then the backup codes are
// shown once.
export type SetupStep =
  | {kind: 'password'}
  | {kind: 'scan'; totpUri: string; backupCodes: string[]}
  | {kind: 'backup'; backupCodes: string[]};

export type SetupState = {
  step: SetupStep;
  password: string;
  code: string;
  error: string | null;
  submitting: boolean;
};

export type SetupOptions = {
  auth: AuthClient;
  t: Messages;
  devCode: DevCode;
  // The admin's address, for the code the dev server tells.
  email: string;
  // After the backup codes: the server is asked again, and shows the
  // admin's app.
  onDone: () => void;
};

// Dev starts with the seeded password filled in.
export function initialSetup(password: string): SetupState {
  return {
    step: {kind: 'password'},
    password,
    code: '',
    error: null,
    submitting: false,
  };
}

export function canSubmitSetup({
  step,
  password,
  code,
  submitting,
}: SetupState): boolean {
  if (submitting) {
    return false;
  }

  switch (step.kind) {
    case 'password':
      return password.length > 0;
    case 'scan':
      return code.trim().length > 0;
    case 'backup':
      return true;
  }
}

// Each client binds it with useTwoFactorSetup.
export function createTwoFactorSetup(
  first: SetupOptions,
  initial: SetupState,
  onChange: (state: SetupState) => void,
) {
  let latest = first;
  let state = initial;
  const options = () => latest;

  function set(patch: Partial<SetupState>) {
    state = {...state, ...patch};
    onChange(state);
  }

  async function run(action: () => Promise<void>) {
    set({submitting: true, error: null});
    await action();
    set({submitting: false});
  }

  async function begin() {
    const {auth, t, devCode, email} = options();
    const outcome = await ask(
      auth.twoFactor.enable({password: state.password}),
    );

    if (!outcome.ok) {
      set({error: enableFailure(outcome.failure, t)});
      return;
    }

    // The plugin can also mail codes, which this server never asks for:
    // an answer, but not one this screen knows.
    const {method, totpURI, backupCodes = []} = outcome.data;
    if (method !== 'totp' || !totpURI) {
      set({error: errorMessage('UNKNOWN', t)});
      return;
    }

    const code = await devCode(email, 'totp');
    set({
      step: {kind: 'scan', totpUri: totpURI, backupCodes},
      password: '',
      code,
    });
  }

  async function verify(backupCodes: string[]) {
    const {auth, t} = options();
    const outcome = await ask(
      auth.twoFactor.verifyTotp({code: state.code.trim()}),
    );

    if (!outcome.ok) {
      set({error: verifyFailure(outcome.failure, t)});
      return;
    }

    set({step: {kind: 'backup', backupCodes}});
  }

  return {
    // The latest options, such as the language picked meanwhile, for
    // what comes next.
    use(next: SetupOptions) {
      latest = next;
    },

    edit(patch: Partial<Pick<SetupState, 'password' | 'code'>>) {
      set(patch);
    },

    // Sends what the step asks for, and after the backup codes is done.
    async submit() {
      if (!canSubmitSetup(state)) {
        return;
      }

      const {step} = state;
      switch (step.kind) {
        case 'password':
          return run(begin);
        case 'scan':
          return run(() => verify(step.backupCodes));
        case 'backup':
          options().onDone();
          return;
      }
    },
  };
}
