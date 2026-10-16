import {
  checkPasswordReset,
  hasProblems,
  type PasswordResetFields,
} from '../admin/drafts';
import {
  leaveField,
  nothingShown,
  problemShown,
  type Shown,
} from '../admin/useProblems';
import type {Api} from '../api/createApi';
import {codeOf, errorMessage} from '../api/errors';
import type {Messages} from '../i18n/catalog';
import {ask, type AuthClient} from './authClient';
import {
  codeFailure,
  credentialsFailure,
  isStaleChallenge,
  resetFailure,
  totpFailure,
} from './failures';

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

// What the dev server tells of the mail and the authenticator, so dev
// signs in with taps alone. Empty everywhere else.
export type DevCode = (
  email: string,
  kind: 'mailed' | 'totp',
) => Promise<string>;

export type SignInFields = {
  email: string;
  code: string;
  password: string;
  trustDevice: boolean;
  reset: PasswordResetFields;
};

export type SignInState = {
  step: LoginStep;
  fields: SignInFields;
  // Which of the reset step's problems may show.
  resetShown: Shown<keyof PasswordResetFields>;
  error: string | null;
  notice: string | null;
  submitting: boolean;
};

export type SignInOptions = Api & {
  auth: AuthClient;
  t: Messages;
  devCode: DevCode;
};

const EMPTY_RESET: PasswordResetFields = {code: '', next: '', repeat: ''};

// Dev starts with the seeded address and password filled in.
export function initialSignIn(prefill: {
  email: string;
  password: string;
}): SignInState {
  return {
    step: {kind: 'email'},
    fields: {
      email: prefill.email,
      code: '',
      password: prefill.password,
      trustDevice: true,
      reset: EMPTY_RESET,
    },
    resetShown: nothingShown(),
    error: null,
    notice: null,
    submitting: false,
  };
}

// The reset step always sends, and shows what is wrong instead when
// something is.
export function canSubmit({step, fields, submitting}: SignInState): boolean {
  if (submitting) {
    return false;
  }

  switch (step.kind) {
    case 'email':
      return fields.email.trim().length > 0;
    case 'code':
    case 'totp':
      return fields.code.trim().length > 0;
    case 'password':
      return fields.password.length > 0;
    case 'reset':
      return true;
  }
}

export function resetProblem(
  {fields, resetShown}: SignInState,
  field: keyof PasswordResetFields,
  t: Messages,
): string | null {
  const {problems, changed} = checkPasswordReset(fields.reset, t);
  return problemShown(resetShown, problems, field, changed);
}

// The address is trimmed here, as the server trims it, so the next step
// sends Better Auth the same one. An admin without a password goes
// straight to choosing one.
async function nextStep({api, unwrap}: Api, email: string): Promise<LoginStep> {
  const address = email.trim();
  const {method} = await unwrap(
    api.POST('/sign-in/method', {body: {email: address}}),
  );

  return {kind: method === 'set-password' ? 'reset' : method, email: address};
}

// Moves through the steps and tells why one failed. On success Better
// Auth's session updates, and the client's gate leaves the login screen.
// Each client binds it with useSignIn; options are read at each step, so
// a language picked meanwhile is the one failures are told in.
export function createSignIn(
  first: SignInOptions,
  initial: SignInState,
  onChange: (state: SignInState) => void,
) {
  let latest = first;
  let state = initial;
  const options = () => latest;

  function set(patch: Partial<SignInState>) {
    state = {...state, ...patch};
    onChange(state);
  }

  function setFields(patch: Partial<SignInFields>) {
    set({fields: {...state.fields, ...patch}});
  }

  async function run(action: () => Promise<void>) {
    set({submitting: true, error: null, notice: null});
    await action();
    set({submitting: false});
  }

  async function sendCode(email: string): Promise<boolean> {
    const {auth, t} = options();
    const outcome = await ask(
      auth.emailOtp.sendVerificationOtp({email, type: 'sign-in'}),
    );

    if (!outcome.ok) {
      set({error: codeFailure(outcome.failure, t)});
    }

    return outcome.ok;
  }

  // An admin sets or resets the password with a code mailed to them. A
  // new admin is sent here from the address, one who forgot the password
  // from the password step.
  async function beginReset(email: string) {
    const {auth, t, devCode} = options();
    const outcome = await ask(auth.emailOtp.requestPasswordReset({email}));

    if (!outcome.ok) {
      set({error: codeFailure(outcome.failure, t)});
      return;
    }

    const code = await devCode(email, 'mailed');
    set({
      step: {kind: 'reset', email},
      fields: {...state.fields, reset: {...EMPTY_RESET, code}},
      resetShown: nothingShown(),
    });
  }

  async function continueWithEmail() {
    const {t, devCode} = options();

    let next: LoginStep;
    try {
      next = await nextStep(options(), state.fields.email);
    } catch (failure) {
      set({error: errorMessage(codeOf(failure), t)});
      return;
    }

    if (next.kind === 'reset') {
      await beginReset(next.email);
      return;
    }

    if (next.kind === 'code' && !(await sendCode(next.email))) {
      return;
    }

    const code =
      next.kind === 'code' ? await devCode(next.email, 'mailed') : '';
    set({step: next, fields: {...state.fields, code}});
  }

  async function signInWithCode(email: string) {
    const {auth, t} = options();
    const outcome = await ask(
      auth.signIn.emailOtp({email, otp: state.fields.code.trim()}),
    );

    if (!outcome.ok) {
      set({error: codeFailure(outcome.failure, t)});
    }
  }

  // An admin with an authenticator is asked for its code next.
  async function signInWithPassword(email: string, password: string) {
    const {auth, t, devCode} = options();
    const outcome = await ask(auth.signIn.email({email, password}));

    if (!outcome.ok) {
      set({error: credentialsFailure(outcome.failure, t)});
      return;
    }

    if ('twoFactorRedirect' in outcome.data) {
      const code = await devCode(email, 'totp');
      set({
        step: {kind: 'totp', email, backup: false},
        fields: {...state.fields, code},
      });
    }
  }

  async function signInWithTotp(email: string, backup: boolean) {
    const {auth, t} = options();
    const body = {
      code: state.fields.code.trim(),
      trustDevice: state.fields.trustDevice,
    };
    const outcome = await ask(
      backup
        ? auth.twoFactor.verifyBackupCode(body)
        : auth.twoFactor.verifyTotp(body),
    );

    if (outcome.ok) {
      return;
    }

    // Ten minutes passed since the password: back to it.
    if (isStaleChallenge(outcome.failure)) {
      set({step: {kind: 'password', email}});
    }
    set({error: totpFailure(outcome.failure, t)});
  }

  // A new password signs the admin in at once, on to the authenticator.
  async function finishReset(email: string) {
    const {auth, t} = options();
    const checked = checkPasswordReset(state.fields.reset, t);

    if (hasProblems(checked.problems)) {
      set({resetShown: {...state.resetShown, tried: true}});
      return;
    }

    const {code, next} = checked.value;
    const outcome = await ask(
      auth.emailOtp.resetPassword({email, otp: code, password: next}),
    );

    if (!outcome.ok) {
      set({error: resetFailure(outcome.failure, t)});
      return;
    }

    set({
      step: {kind: 'password', email},
      fields: {...state.fields, password: next},
    });
    await signInWithPassword(email, next);
  }

  return {
    // The latest options, such as the language picked meanwhile, for
    // what comes next.
    use(next: SignInOptions) {
      latest = next;
    },

    edit(patch: Partial<Omit<SignInFields, 'reset'>>) {
      setFields(patch);
    },

    editReset(field: keyof PasswordResetFields, value: string) {
      setFields({reset: {...state.fields.reset, [field]: value}});
    },

    leaveReset(field: keyof PasswordResetFields) {
      set({resetShown: leaveField(state.resetShown, field)});
    },

    // Sends what the step asks for. Nothing while it cannot be sent, such
    // as with the field empty or something already on its way.
    async submit() {
      if (!canSubmit(state)) {
        return;
      }

      const {step, fields} = state;
      switch (step.kind) {
        case 'email':
          return run(continueWithEmail);
        case 'code':
          return run(() => signInWithCode(step.email));
        case 'password':
          return run(() => signInWithPassword(step.email, fields.password));
        case 'totp':
          return run(() => signInWithTotp(step.email, step.backup));
        case 'reset':
          return run(() => finishReset(step.email));
      }
    },

    // A new code for the mailed step.
    async resendCode() {
      const {step} = state;
      if (step.kind !== 'code' || state.submitting) {
        return;
      }

      await run(async () => {
        if (await sendCode(step.email)) {
          setFields({code: ''});
          set({notice: options().t.login.codeSent});
        }
      });
    },

    // Sets the password with a mailed code, from the password step or
    // again from the reset step for a new code.
    async startReset() {
      const {step} = state;
      if (step.kind === 'email' || state.submitting) {
        return;
      }

      await run(() => beginReset(step.email));
    },

    toggleBackup() {
      const {step} = state;
      if (step.kind !== 'totp') {
        return;
      }

      set({
        step: {...step, backup: !step.backup},
        fields: {...state.fields, code: ''},
        error: null,
      });
    },

    backToEmail() {
      set({step: {kind: 'email'}, error: null, notice: null});
    },
  };
}

export type SignIn = ReturnType<typeof createSignIn>;
