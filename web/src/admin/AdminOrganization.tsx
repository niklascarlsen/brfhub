import {useState, type SubmitEvent} from 'react';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {
  fieldLabel,
  isWrittenOrEmpty,
  trimmedText,
  type Draft,
} from '@/admin/localized';
import {PRIMARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap, type LocalizedText} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {CATALOGS, LOCALES, type Locale, type Messages} from '@/i18n/catalog';
import {useMessages} from '@/i18n/LocaleProvider';

const MIN_PASSWORD_LENGTH = 8;
const MAX_WINDOW_DAYS = 365;

function fetchSettings() {
  return unwrap(api.GET('/admin/organization'));
}

type SettingsFields = {
  name: string;
  bookingWindowDays: number;
  locales: Locale[];
  rulesText: LocalizedText;
};

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SettingsFields;
  onSaved: () => void;
}) {
  const t = useMessages();
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState(String(initial.bookingWindowDays));
  const [locales, setLocales] = useState(initial.locales);
  const [rulesText, setRulesText] = useState<Draft>(initial.rulesText);
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
      setMessage(t.admin.organization.windowRange(MAX_WINDOW_DAYS));
      return;
    }

    const rules = trimmedText(rulesText, locales);
    if (!isWrittenOrEmpty(rules, locales)) {
      setMessage(t.admin.localized.rulesInEvery);
      return;
    }

    // Unchanged rules stay as they are, so a language turned off keeps
    // its text.
    const rulesChanged =
      JSON.stringify(rules) !==
      JSON.stringify(trimmedText(initial.rulesText, locales));

    setSubmitting(true);
    try {
      await unwrap(
        api.PATCH('/admin/organization', {
          body: {
            name: name.trim(),
            bookingWindowDays,
            locales,
            ...(rulesChanged ? {rulesText: rules} : {}),
          },
        }),
      );
      setMessage(t.admin.organization.saved);
      onSaved();
    } catch (caught) {
      setMessage(errorMessage(codeOf(caught), t));
    }
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      <FloatingLabelInput
        label={t.admin.organization.name}
        required
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <FloatingLabelInput
        label={t.admin.organization.windowDays}
        type='number'
        inputMode='numeric'
        min={1}
        max={MAX_WINDOW_DAYS}
        required
        value={days}
        onChange={(event) => setDays(event.target.value)}
      />
      <p className='text-[13px] leading-5 text-theme-muted'>
        {t.admin.organization.windowNote}
      </p>
      <fieldset className='mt-2 flex flex-col gap-2'>
        <legend className='mb-2 text-[13px] font-medium text-theme-muted'>
          {t.admin.organization.languages}
        </legend>
        <div className='flex flex-wrap gap-2'>
          {LOCALES.map((language) => {
            const selected = locales.includes(language);

            return (
              <button
                key={language}
                type='button'
                lang={language}
                aria-pressed={selected}
                // The organization writes in at least one language.
                disabled={selected && locales.length === 1}
                onClick={() =>
                  setLocales(
                    LOCALES.filter((item) =>
                      item === language ? !selected : locales.includes(item),
                    ),
                  )
                }
                className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-theme-ink bg-theme-ink text-theme-surface'
                    : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
                }`}
              >
                {CATALOGS[language].language.name}
              </button>
            );
          })}
        </div>
        <span className='text-[13px] leading-5 text-theme-muted'>
          {t.admin.organization.languagesNote}
        </span>
      </fieldset>
      {locales.map((language) => (
        <label key={language} className='mt-2 flex flex-col gap-1.5'>
          <span className='text-[13px] font-medium text-theme-muted'>
            {fieldLabel(t.admin.organization.rules, language, locales, t)}
          </span>
          <textarea
            lang={language}
            maxLength={4000}
            rows={5}
            placeholder={t.admin.organization.rulesPlaceholder}
            value={rulesText[language] ?? ''}
            onChange={(event) =>
              setRulesText({...rulesText, [language]: event.target.value})
            }
            className='w-full rounded-xs border border-theme-edge bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink placeholder:text-theme-faint focus:border-theme-ink'
          />
        </label>
      ))}
      <span className='text-[13px] leading-5 text-theme-muted'>
        {t.admin.organization.rulesNote}
      </span>
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
        {t.admin.save}
      </button>
    </form>
  );
}

function Settings() {
  const t = useMessages();
  const refresh = useRefreshAccount();
  const {data, error, reload} = useFocusLoad(fetchSettings);

  return (
    <section aria-labelledby='settings-heading' className='mb-6.5'>
      <h2 id='settings-heading' className={SECTION_LABEL}>
        {t.admin.organization.settings}
      </h2>
      {data ? (
        // Saved elsewhere since it was opened: start over from what the
        // server has, so a save cannot put the old values back.
        <SettingsForm
          key={JSON.stringify(data)}
          initial={data}
          onSaved={refresh}
        />
      ) : error ? (
        <Notice
          message={error}
          actionLabel={t.common.retry}
          onAction={reload}
        />
      ) : null}
    </section>
  );
}

async function signOutAdmin() {
  await authClient.signOut();
}

function changeMessage(code: string | undefined, t: Messages): string {
  switch (code) {
    case 'INVALID_PASSWORD':
      return t.admin.organization.wrongPassword;
    case 'PASSWORD_TOO_SHORT':
      return t.admin.organization.passwordTooShort(MIN_PASSWORD_LENGTH);
    case 'PASSWORD_TOO_LONG':
      return t.admin.organization.passwordTooLong;
    default:
      return errorMessage('UNKNOWN', t);
  }
}

// The admin account is shared by the board, so a new password is how it is
// handed over: every other device signed in to it is signed out.
function ChangePassword() {
  const t = useMessages();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setMessage(changeMessage('PASSWORD_TOO_SHORT', t));
      return;
    }
    if (next !== repeat) {
      setMessage(t.admin.organization.passwordsDiffer);
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
      setMessage(errorMessage('NETWORK', t));
      return;
    }

    if (result.error) {
      setMessage(changeMessage(result.error.code, t));
      return;
    }

    setCurrent('');
    setNext('');
    setRepeat('');
    setMessage(t.admin.organization.passwordChanged);
  }

  return (
    <section aria-labelledby='password-heading'>
      <h2 id='password-heading' className={SECTION_LABEL}>
        {t.admin.organization.changePassword}
      </h2>
      <form
        onSubmit={(event) => void submit(event)}
        className='flex flex-col gap-3'
      >
        <FloatingLabelInput
          label={t.admin.organization.currentPassword}
          type='password'
          autoComplete='current-password'
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <FloatingLabelInput
          label={t.admin.organization.newPassword}
          type='password'
          autoComplete='new-password'
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <FloatingLabelInput
          label={t.admin.organization.repeatPassword}
          type='password'
          autoComplete='new-password'
          required
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
        <p className='text-[13px] leading-5 text-theme-muted'>
          {t.admin.organization.passwordNote}
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
          {t.admin.organization.changePassword}
        </button>
      </form>
    </section>
  );
}

export function AdminOrganization() {
  const account = useAdminAccount();
  const t = useMessages();

  return (
    <AdminPage title={t.tabs.organization} subtitle={account.organizationName}>
      <Account
        signOutFrom={account.organizationName}
        onSignOut={signOutAdmin}
      />
      <Settings />
      <ChangePassword />
    </AdminPage>
  );
}
