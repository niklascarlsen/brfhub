import {useState, type SubmitEvent} from 'react';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';

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
      setError(errorMessage('NETWORK'));
      setSubmitting(false);
      return;
    }

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
          className='flex w-full flex-col lg:w-120 lg:p-2'
        >
          <h1 className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
            Logga in
          </h1>
          <p className='mb-6 text-sm leading-5 text-theme-muted'>
            Med e-posten för lägenheten eller föreningens admin.
          </p>
          <FloatingLabelInput
            className='mb-3'
            label='E-post'
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
            label='Lösenord'
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
            Logga in
          </button>
        </form>
      </main>
    </div>
  );
}
