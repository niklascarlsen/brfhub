import {useState, type SubmitEvent} from 'react';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {PRIMARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {useFocusLoad} from '@/hooks/useFocusLoad';

const MIN_PASSWORD_LENGTH = 8;
const MAX_WINDOW_DAYS = 365;

function fetchSettings() {
  return unwrap(api.GET('/admin/organization'));
}

type SettingsFields = {name: string; bookingWindowDays: number};

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SettingsFields;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState(String(initial.bookingWindowDays));
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const bookingWindowDays = Number(days);
    if (
      !Number.isInteger(bookingWindowDays) ||
      bookingWindowDays < 1 ||
      bookingWindowDays > MAX_WINDOW_DAYS
    ) {
      setMessage(`Bokningsfönstret är 1 till ${MAX_WINDOW_DAYS} dagar`);
      return;
    }

    setSubmitting(true);
    try {
      await unwrap(
        api.PATCH('/admin/organization', {
          body: {name: name.trim(), bookingWindowDays},
        }),
      );
      setMessage('Sparat.');
      onSaved();
    } catch (caught) {
      setMessage(errorMessage(codeOf(caught)));
    }
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      <FloatingLabelInput
        label='Föreningens namn'
        required
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <FloatingLabelInput
        label='Bokningsbart antal dagar framåt'
        type='number'
        inputMode='numeric'
        min={1}
        max={MAX_WINDOW_DAYS}
        required
        value={days}
        onChange={(event) => setDays(event.target.value)}
      />
      <p className='text-[13px] leading-5 text-theme-muted'>
        Ett längre fönster öppnar fler dagar direkt. Ett kortare tar inte bort
        bokningar som redan är gjorda.
      </p>
      {message ? (
        <p role='status' className='text-sm text-theme-ink'>
          {message}
        </p>
      ) : null}
      <button
        type='submit'
        disabled={submitting}
        className={`${PRIMARY_BUTTON} mt-2 self-start`}
      >
        Spara
      </button>
    </form>
  );
}

function Settings() {
  const refresh = useRefreshAccount();
  const {data, error, reload} = useFocusLoad(fetchSettings);

  return (
    <section aria-labelledby='settings-heading' className='mb-6.5'>
      <h2 id='settings-heading' className={SECTION_LABEL}>
        Inställningar
      </h2>
      {data ? (
        <SettingsForm initial={data} onSaved={refresh} />
      ) : error ? (
        <Notice message={error} actionLabel='Försök igen' onAction={reload} />
      ) : null}
    </section>
  );
}

async function signOutAdmin() {
  await authClient.signOut();
}

function changeMessage(code: string | undefined): string {
  switch (code) {
    case 'INVALID_PASSWORD':
      return 'Det nuvarande lösenordet stämmer inte';
    case 'PASSWORD_TOO_SHORT':
      return `Det nya lösenordet måste ha minst ${MIN_PASSWORD_LENGTH} tecken`;
    case 'PASSWORD_TOO_LONG':
      return 'Det nya lösenordet är för långt';
    default:
      return errorMessage('UNKNOWN');
  }
}

// The admin account is shared by the board, so a new password is how it is
// handed over: every other device signed in to it is signed out.
function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setMessage(changeMessage('PASSWORD_TOO_SHORT'));
      return;
    }
    if (next !== repeat) {
      setMessage('De nya lösenorden är inte lika');
      return;
    }

    setSubmitting(true);
    // Better Auth throws rather than answers when the network fails.
    const result = await authClient
      .changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      })
      .catch(() => null);
    setSubmitting(false);

    if (result === null) {
      setMessage(errorMessage('NETWORK'));
      return;
    }

    if (result.error) {
      setMessage(changeMessage(result.error.code));
      return;
    }

    setCurrent('');
    setNext('');
    setRepeat('');
    setMessage('Lösenordet är bytt. Alla andra enheter har loggats ut.');
  }

  return (
    <section aria-labelledby='password-heading'>
      <h2 id='password-heading' className={SECTION_LABEL}>
        Byt lösenord
      </h2>
      <form
        onSubmit={(event) => void submit(event)}
        className='flex flex-col gap-3'
      >
        <FloatingLabelInput
          label='Nuvarande lösenord'
          type='password'
          autoComplete='current-password'
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <FloatingLabelInput
          label='Nytt lösenord'
          type='password'
          autoComplete='new-password'
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <FloatingLabelInput
          label='Nytt lösenord igen'
          type='password'
          autoComplete='new-password'
          required
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
        <p className='text-[13px] leading-5 text-theme-muted'>
          Byt lösenord när styrelsen byts. Alla andra enheter loggas ut.
        </p>
        {message ? (
          <p role='status' className='text-sm text-theme-ink'>
            {message}
          </p>
        ) : null}
        <button
          type='submit'
          disabled={submitting}
          className={`${PRIMARY_BUTTON} mt-2 self-start`}
        >
          Byt lösenord
        </button>
      </form>
    </section>
  );
}

export function AdminOrganization() {
  const account = useAdminAccount();

  return (
    <AdminPage title='Föreningen' subtitle={account.organizationName}>
      <Account
        signOutFrom={account.organizationName}
        onSignOut={signOutAdmin}
      />
      <Settings />
      <ChangePassword />
    </AdminPage>
  );
}
