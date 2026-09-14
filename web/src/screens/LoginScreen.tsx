import {useState, type SubmitEvent} from 'react';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';

const FIELD =
  'h-12 w-full rounded-xl border border-theme-edge bg-theme-surface px-4 text-base text-theme-ink placeholder:text-theme-faint';

// The rate limiter answers 429 without a code, so status is what tells
// the cases apart.
function loginMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Fel e-post eller lösenord';
    case 429:
      return 'För många försök, vänta en stund';
    case 403:
      return 'Servern tillåter inte den här adressen';
    default:
      return errorMessage('NETWORK');
  }
}

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await authClient.signIn.email({email, password});

    if (result.error) {
      setError(loginMessage(result.error.status));
      setSubmitting(false);
    }
    // On success useSession updates and the gate unmounts this screen.
  }

  return (
    <div className='flex min-h-svh flex-col bg-theme-bg pt-[env(safe-area-inset-top)]'>
      <main className='flex grow flex-col justify-center px-5 pb-16 lg:items-center'>
        <form
          onSubmit={(event) => void onSubmit(event)}
          className='flex w-full flex-col lg:w-90 lg:rounded-2xl lg:border lg:border-theme-line lg:bg-theme-surface lg:p-8'
        >
          <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
            Logga in
          </h1>
          <p className='mb-6 text-sm leading-5 text-theme-muted'>
            Med e-posten som är kopplad till din lägenhet.
          </p>
          <label className='mb-3 flex flex-col gap-1.5'>
            <span className='ml-0.5 text-[13px] font-medium text-theme-muted'>
              E-post
            </span>
            <input
              type='email'
              name='email'
              autoComplete='email'
              inputMode='email'
              autoCapitalize='none'
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD}
            />
          </label>
          <label className='mb-5 flex flex-col gap-1.5'>
            <span className='ml-0.5 text-[13px] font-medium text-theme-muted'>
              Lösenord
            </span>
            <input
              type='password'
              name='password'
              autoComplete='current-password'
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={FIELD}
            />
          </label>
          {error ? (
            <p role='alert' className='mb-4 text-sm text-theme-ink'>
              {error}
            </p>
          ) : null}
          <button
            type='submit'
            disabled={submitting}
            className='h-12 rounded-full bg-theme-ink text-base font-semibold tracking-tight text-theme-surface transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50'
          >
            Logga in
          </button>
        </form>
      </main>
    </div>
  );
}
