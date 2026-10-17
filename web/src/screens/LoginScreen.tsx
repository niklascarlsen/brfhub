import {useSignIn} from '@booking/core/auth/useSignIn';
import {useEffect, useId, type SubmitEvent} from 'react';

import {api, unwrap} from '@/api/client';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {DEV_EMAIL, DEV_PASSWORD, devCode} from '@/lib/devCodes';

const BUTTON =
  'h-14 rounded-xs bg-theme-ink text-base font-semibold tracking-tight text-theme-surface transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50';
const LINK =
  'py-2 text-sm font-semibold text-theme-accent hover:underline disabled:opacity-50';

// Signing in is two steps: the address, then the code it is mailed or, for
// an admin, the password. On success useSession updates and the gate
// unmounts this screen.
export function LoginScreen() {
  const t = useMessages();
  const signIn = useSignIn({
    api,
    unwrap,
    auth: authClient,
    t,
    devCode,
    prefill: {email: DEV_EMAIL, password: DEV_PASSWORD},
  });
  const {step, fields, error, notice, submitting, canSubmit} = signIn;
  const trustId = useId();

  // The tab still names the page signed out from until this says otherwise.
  useEffect(() => {
    document.title = t.login.title;
  }, [t]);

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn.submit();
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
          value={fields.email}
          onChange={(event) => signIn.edit({email: event.target.value})}
        />
        {problem}
        <button type='submit' disabled={!canSubmit} className={BUTTON}>
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
          value={fields.code}
          onChange={(event) => signIn.edit({code: event.target.value})}
        />
        {problem}
        <button type='submit' disabled={!canSubmit} className={BUTTON}>
          {t.login.submit}
        </button>
        <div className='mt-3 flex gap-6'>
          <button
            type='button'
            onClick={() => void signIn.resendCode()}
            disabled={submitting}
            className={LINK}
          >
            {t.login.sendNewCode}
          </button>
          <button type='button' onClick={signIn.backToEmail} className={LINK}>
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
          value={fields.password}
          onChange={(event) => signIn.edit({password: event.target.value})}
        />
        {problem}
        <button type='submit' disabled={!canSubmit} className={BUTTON}>
          {t.login.submit}
        </button>
        <div className='mt-3 flex flex-wrap gap-x-6'>
          <button
            type='button'
            onClick={() => void signIn.startReset()}
            disabled={submitting}
            className={LINK}
          >
            {t.login.setPassword}
          </button>
          <button type='button' onClick={signIn.backToEmail} className={LINK}>
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
          value={fields.code}
          onChange={(event) => signIn.edit({code: event.target.value})}
        />
        <label
          htmlFor={trustId}
          className='mb-5 flex items-center gap-2.5 self-start py-1 text-sm text-theme-ink'
        >
          <input
            id={trustId}
            type='checkbox'
            checked={fields.trustDevice}
            onChange={(event) =>
              signIn.edit({trustDevice: event.target.checked})
            }
            className='h-5 w-5 accent-theme-ink'
          />
          {t.login.trustDevice}
        </label>
        {problem}
        <button type='submit' disabled={!canSubmit} className={BUTTON}>
          {t.login.submit}
        </button>
        <div className='mt-3 flex flex-wrap gap-x-6'>
          <button type='button' onClick={signIn.toggleBackup} className={LINK}>
            {backup ? t.login.useTotp : t.login.useBackupCode}
          </button>
          <button type='button' onClick={signIn.backToEmail} className={LINK}>
            {t.login.startOver}
          </button>
        </div>
      </>
    );
  } else {
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
            value={fields.reset.code}
            onChange={(event) => signIn.editReset('code', event.target.value)}
            onBlur={() => signIn.leaveReset('code')}
            problem={signIn.resetProblem('code')}
          />
          <FloatingLabelInput
            label={t.login.newPassword}
            type='password'
            name='password'
            autoComplete='new-password'
            value={fields.reset.next}
            onChange={(event) => signIn.editReset('next', event.target.value)}
            onBlur={() => signIn.leaveReset('next')}
            problem={signIn.resetProblem('next')}
          />
          <FloatingLabelInput
            label={t.login.repeatPassword}
            type='password'
            name='repeat'
            autoComplete='new-password'
            value={fields.reset.repeat}
            onChange={(event) => signIn.editReset('repeat', event.target.value)}
            onBlur={() => signIn.leaveReset('repeat')}
            problem={signIn.resetProblem('repeat')}
          />
        </div>
        {problem}
        <button type='submit' disabled={!canSubmit} className={BUTTON}>
          {t.login.resetSubmit}
        </button>
        <div className='mt-3 flex flex-wrap gap-x-6'>
          <button
            type='button'
            onClick={() => void signIn.startReset()}
            disabled={submitting}
            className={LINK}
          >
            {t.login.sendNewCode}
          </button>
          <button type='button' onClick={signIn.backToEmail} className={LINK}>
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
