import {errorMessage} from '@booking/core/api/errors';
import type {Messages} from '@booking/core/i18n/catalog';
import {useState, type SubmitEvent} from 'react';

import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

// The rate limiter answers 429 without a code, so status is what tells
// the cases apart.
function loginMessage(status: number, t: Messages): string {
  switch (status) {
    case 401:
      return t.login.wrongCredentials;
    case 429:
      return t.login.tooManyAttempts;
    case 403:
      return t.login.originRefused;
    default:
      return errorMessage('NETWORK', t);
  }
}

export function LoginScreen() {
  const t = useMessages();
  const [email, setEmail] = useState('12@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    // Better Auth throws rather than answers when the network fails.
    const result = await authClient.signIn
      .email({email, password})
      .catch(() => null);

    if (result === null) {
      setError(errorMessage('NETWORK', t));
      setSubmitting(false);
      return;
    }

    if (result.error) {
      setError(loginMessage(result.error.status, t));
      setSubmitting(false);
    }
    // On success useSession updates and the gate unmounts this screen.
  }

  return (
    <div className='flex min-h-svh flex-col bg-theme-bg pt-[env(safe-area-inset-top)]'>
      <main className='flex grow flex-col justify-center px-5 pb-16 lg:items-center'>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className='flex w-full flex-col lg:w-120 lg:p-2'
        >
          <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
            {t.login.title}
          </h1>
          <p className='mb-6 text-sm leading-5 text-theme-muted'>
            {t.login.intro}
          </p>
          <FloatingLabelInput
            className='mb-3'
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
          <FloatingLabelInput
            className='mb-5'
            label={t.login.password}
            type='password'
            name='password'
            autoComplete='current-password'
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? (
            <p role='alert' className='mb-4 text-sm text-theme-ink'>
              {error}
            </p>
          ) : null}
          <button
            type='submit'
            disabled={submitting}
            className='h-14 rounded-xs bg-theme-ink text-base font-semibold tracking-tight text-theme-surface transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50'
          >
            {t.login.submit}
          </button>
        </form>
      </main>
    </div>
  );
}
