import {
  checkPasswordReset,
  type PasswordResetFields,
} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import {codeOf, errorMessage} from '@booking/core/api/errors';
import {
  codeFailure,
  isStaleChallenge,
  nextStep,
  passwordFailure,
  resetFailure,
  totpFailure,
  type LoginStep,
} from '@booking/core/auth/login';
import {limits} from '@booking/core/generated/limits';
import {useId, useState, type SubmitEvent} from 'react';

import {api, unwrap} from '@/api/client';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {DEV_EMAIL, DEV_PASSWORD, devCode} from '@/lib/devCodes';

const BUTTON =
  'h-14 rounded-xs bg-theme-ink text-base font-semibold tracking-tight text-theme-surface transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50';
const LINK =
  'py-2 text-sm font-semibold text-theme-accent hover:underline disabled:opacity-50';
const EMPTY_RESET: PasswordResetFields = {code: '', next: '', repeat: ''};

// Signing in is two steps: the address, then the code it is mailed or, for
// an admin, the password. On success useSession updates and the gate
// unmounts this screen.
export function LoginScreen() {
  const t = useMessages();
  const [step, setStep] = useState<LoginStep>({kind: 'email'});
  const [email, setEmail] = useState(DEV_EMAIL);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [trustDevice, setTrustDevice] = useState(true);
  const [reset, setReset] = useState(EMPTY_RESET);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trustId = useId();
  const checkedReset = checkPasswordReset(reset, t);
  const resetProblems = useProblems(checkedReset);

  async function sendCode(address: string): Promise<boolean> {
    // Better Auth throws rather than answers when the network fails.
    const result = await authClient.emailOtp
      .sendVerificationOtp({email: address, type: 'sign-in'})
      .catch(() => null);

    if (result === null || result.error) {
      setError(codeFailure(result?.error ?? null, t));
      return false;
    }

    return true;
  }

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    await action();
    setSubmitting(false);
  }

  const continueWithEmail = () =>
    run(async () => {
      let next: LoginStep;
      try {
        next = await nextStep({api, unwrap}, email);
      } catch (failure) {
        setError(errorMessage(codeOf(failure), t));
        return;
      }

      if (next.kind === 'code' && !(await sendCode(next.email))) {
        return;
      }

      if (next.kind === 'reset') {
        await beginReset(next.email);
        return;
      }

      setCode(next.kind === 'code' ? await devCode(next.email, 'mailed') : '');
      setStep(next);
    });

  const signInWithCode = (address: string) =>
    run(async () => {
      const result = await authClient.signIn
        .emailOtp({email: address, otp: code.trim()})
        .catch(() => null);

      if (result === null || result.error) {
        setError(codeFailure(result?.error ?? null, t));
      }
    });

  // An admin with an authenticator is asked for its code next.
  const signInWithPassword = (address: string, secret: string) =>
    run(async () => {
      const result = await authClient.signIn
        .email({email: address, password: secret})
        .catch(() => null);

      if (result === null || result.error) {
        setError(passwordFailure(result?.error ?? null, t));
        return;
      }

      if ('twoFactorRedirect' in result.data) {
        setCode(await devCode(address, 'totp'));
        setStep({kind: 'totp', email: address, backup: false});
      }
    });

  const signInWithTotp = (address: string, backup: boolean) =>
    run(async () => {
      const verify = backup
        ? authClient.twoFactor.verifyBackupCode({
            code: code.trim(),
            trustDevice,
          })
        : authClient.twoFactor.verifyTotp({code: code.trim(), trustDevice});
      const result = await verify.catch(() => null);

      if (result === null || result.error) {
        const failure = result?.error ?? null;
        // Ten minutes passed since the password: back to it.
        if (isStaleChallenge(failure)) {
          setStep({kind: 'password', email: address});
        }
        setError(totpFailure(failure, t));
      }
    });

  // An admin sets or resets the password with a code mailed to them, and
  // is signed in with it at once. A new admin is sent here from the
  // address, one who forgot the password from the password step.
  async function beginReset(address: string): Promise<void> {
    const result = await authClient.emailOtp
      .requestPasswordReset({email: address})
      .catch(() => null);

    if (result === null || result.error) {
      setError(codeFailure(result?.error ?? null, t));
      return;
    }

    setReset({...EMPTY_RESET, code: await devCode(address, 'mailed')});
    resetProblems.reset();
    setStep({kind: 'reset', email: address});
  }

  const startReset = (address: string) => run(() => beginReset(address));

  const finishReset = (address: string) =>
    run(async () => {
      if (!resetProblems.ready()) {
        return;
      }

      const result = await authClient.emailOtp
        .resetPassword({
          email: address,
          otp: checkedReset.value.code,
          password: checkedReset.value.next,
        })
        .catch(() => null);

      if (result === null || result.error) {
        setError(
          resetFailure(
            result?.error ?? null,
            t,
            limits.ChangePasswordBody.newPassword,
          ),
        );
        return;
      }

      setPassword(checkedReset.value.next);
      setStep({kind: 'password', email: address});
      await signInWithPassword(address, checkedReset.value.next);
    });

  const resendCode = (address: string) =>
    run(async () => {
      if (await sendCode(address)) {
        setCode('');
        setNotice(t.login.codeSent);
      }
    });

  const backToEmail = () => {
    setStep({kind: 'email'});
    setError(null);
    setNotice(null);
  };

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    if (step.kind === 'email') {
      void continueWithEmail();
    } else if (step.kind === 'code') {
      void signInWithCode(step.email);
    } else if (step.kind === 'password') {
      void signInWithPassword(step.email, password);
    } else if (step.kind === 'totp') {
      void signInWithTotp(step.email, step.backup);
    } else {
      void finishReset(step.email);
    }
  }

  const problem = error ? (
    <p role='alert' className='mb-4 text-sm text-theme-ink'>
      {error}
    </p>
  ) : notice ? (
    <p className='mb-4 text-sm text-theme-muted'>{notice}</p>
  ) : null;

  let body;
  if (step.kind === 'email') {
    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.title}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.login.intro}
        </p>
        <FloatingLabelInput
          className='mb-5'
          label={t.common.email}
          type='email'
          name='email'
          autoComplete='email'
          inputMode='email'
          autoCapitalize='none'
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {problem}
        <button type='submit' disabled={submitting} className={BUTTON}>
          {t.login.continue}
        </button>
      </>
    );
  } else if (step.kind === 'code') {
    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.codeTitle}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.login.codeIntro(step.email)}
        </p>
        <FloatingLabelInput
          className='mb-5'
          label={t.login.code}
          type='text'
          name='code'
          autoComplete='one-time-code'
          inputMode='numeric'
          autoFocus
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {problem}
        <button type='submit' disabled={submitting} className={BUTTON}>
          {t.login.submit}
        </button>
        <div className='mt-3 flex gap-6'>
          <button
            type='button'
            onClick={() => void resendCode(step.email)}
            disabled={submitting}
            className={LINK}
          >
            {t.login.sendNewCode}
          </button>
          <button type='button' onClick={backToEmail} className={LINK}>
            {t.login.changeEmail}
          </button>
        </div>
      </>
    );
  } else if (step.kind === 'password') {
    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.passwordTitle}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.login.passwordIntro(step.email)}
        </p>
        {/* The address rides along hidden, so the browser can save both. */}
        <input
          type='email'
          name='email'
          autoComplete='username'
          value={step.email}
          readOnly
          hidden
        />
        <FloatingLabelInput
          className='mb-5'
          label={t.login.password}
          type='password'
          name='password'
          autoComplete='current-password'
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {problem}
        <button type='submit' disabled={submitting} className={BUTTON}>
          {t.login.submit}
        </button>
        <div className='mt-3 flex flex-wrap gap-x-6'>
          <button
            type='button'
            onClick={() => void startReset(step.email)}
            disabled={submitting}
            className={LINK}
          >
            {t.login.setPassword}
          </button>
          <button type='button' onClick={backToEmail} className={LINK}>
            {t.login.changeEmail}
          </button>
        </div>
      </>
    );
  } else if (step.kind === 'totp') {
    const {backup} = step;

    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {backup ? t.login.backupTitle : t.login.totpTitle}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {backup ? t.login.backupIntro : t.login.totpIntro}
        </p>
        <FloatingLabelInput
          className='mb-4'
          label={backup ? t.login.backupCode : t.login.totpCode}
          type='text'
          name='code'
          autoComplete={backup ? 'off' : 'one-time-code'}
          inputMode={backup ? 'text' : 'numeric'}
          autoCapitalize='none'
          autoFocus
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <label
          htmlFor={trustId}
          className='mb-5 flex items-center gap-2.5 self-start py-1 text-sm text-theme-ink'
        >
          <input
            id={trustId}
            type='checkbox'
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
            className='h-5 w-5 accent-theme-ink'
          />
          {t.login.trustDevice}
        </label>
        {problem}
        <button type='submit' disabled={submitting} className={BUTTON}>
          {t.login.submit}
        </button>
        <div className='mt-3 flex flex-wrap gap-x-6'>
          <button
            type='button'
            onClick={() => {
              setCode('');
              setError(null);
              setStep({...step, backup: !backup});
            }}
            className={LINK}
          >
            {backup ? t.login.useTotp : t.login.useBackupCode}
          </button>
          <button type='button' onClick={backToEmail} className={LINK}>
            {t.login.startOver}
          </button>
        </div>
      </>
    );
  } else {
    const setField = (key: keyof PasswordResetFields) => (value: string) =>
      setReset((previous) => ({...previous, [key]: value}));

    body = (
      <>
        <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.resetTitle}
        </h1>
        <p className='mb-6 text-sm leading-5 text-theme-muted'>
          {t.login.resetIntro(step.email)}
        </p>
        <input
          type='email'
          name='email'
          autoComplete='username'
          value={step.email}
          readOnly
          hidden
        />
        <div className='mb-5 flex flex-col gap-3'>
          <FloatingLabelInput
            label={t.login.code}
            type='text'
            name='code'
            autoComplete='one-time-code'
            inputMode='numeric'
            autoFocus
            value={reset.code}
            onChange={(event) => setField('code')(event.target.value)}
            onBlur={() => resetProblems.leave('code')}
            problem={resetProblems.problem('code')}
          />
          <FloatingLabelInput
            label={t.login.newPassword}
            type='password'
            name='password'
            autoComplete='new-password'
            value={reset.next}
            onChange={(event) => setField('next')(event.target.value)}
            onBlur={() => resetProblems.leave('next')}
            problem={resetProblems.problem('next')}
          />
          <FloatingLabelInput
            label={t.login.repeatPassword}
            type='password'
            name='repeat'
            autoComplete='new-password'
            value={reset.repeat}
            onChange={(event) => setField('repeat')(event.target.value)}
            onBlur={() => resetProblems.leave('repeat')}
            problem={resetProblems.problem('repeat')}
          />
        </div>
        {problem}
        <button type='submit' disabled={submitting} className={BUTTON}>
          {t.login.resetSubmit}
        </button>
        <div className='mt-3 flex flex-wrap gap-x-6'>
          <button
            type='button'
            onClick={() => void startReset(step.email)}
            disabled={submitting}
            className={LINK}
          >
            {t.login.sendNewCode}
          </button>
          <button type='button' onClick={backToEmail} className={LINK}>
            {t.login.changeEmail}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className='flex min-h-svh flex-col bg-theme-bg pt-[env(safe-area-inset-top)]'>
      <main className='flex grow flex-col justify-center px-5 pb-16 lg:items-center'>
        <form
          key={step.kind}
          noValidate={step.kind === 'reset'}
          onSubmit={onSubmit}
          className='flex w-full flex-col lg:w-120 lg:p-2'
        >
          {body}
        </form>
      </main>
    </div>
  );
}
