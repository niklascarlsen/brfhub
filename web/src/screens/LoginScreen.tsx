import {codeOf, errorMessage} from '@booking/core/api/errors';
import {
  codeFailure,
  nextStep,
  passwordFailure,
  type LoginStep,
} from '@booking/core/auth/login';
import {useState, type SubmitEvent} from 'react';

import {api, unwrap} from '@/api/client';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

// The seeded apartment and admin password, so a development build signs
// in with a couple of clicks. The apartment's code is read in Mailpit.
const DEV_EMAIL = import.meta.env.DEV ? '12@example.com' : '';
const DEV_PASSWORD = import.meta.env.DEV ? 'password' : '';

const BUTTON =
  'h-14 rounded-xs bg-theme-ink text-base font-semibold tracking-tight text-theme-surface transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50';
const LINK =
  'py-2 text-sm font-semibold text-theme-accent hover:underline disabled:opacity-50';

// Signing in is two steps: the address, then the code it is mailed or, for
// an admin, the password. On success useSession updates and the gate
// unmounts this screen.
export function LoginScreen() {
  const t = useMessages();
  const [step, setStep] = useState<LoginStep>({kind: 'email'});
  const [email, setEmail] = useState(DEV_EMAIL);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

      setCode('');
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

  const signInWithPassword = (address: string) =>
    run(async () => {
      const result = await authClient.signIn
        .email({email: address, password})
        .catch(() => null);

      if (result === null || result.error) {
        setError(passwordFailure(result?.error ?? null, t));
      }
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
    } else {
      void signInWithPassword(step.email);
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
  } else {
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
        <div className='mt-3 flex'>
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
          onSubmit={onSubmit}
          className='flex w-full flex-col lg:w-120 lg:p-2'
        >
          {body}
        </form>
      </main>
    </div>
  );
}
