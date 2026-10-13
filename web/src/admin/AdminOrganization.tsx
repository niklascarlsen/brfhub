import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import {
  isWrittenOrEmpty,
  trimmedText,
  type Draft,
} from '@booking/core/admin/localized';
import {codeOf, errorMessage} from '@booking/core/api/errors';
import type {LocalizedText} from '@booking/core/api/types';
import {
  CATALOGS,
  LOCALES,
  type Locale,
  type Messages,
} from '@booking/core/i18n/catalog';
import {useId, useState, type ReactNode, type SubmitEvent} from 'react';

import {AdminPage} from '@/admin/AdminPage';
import {FormActions} from '@/admin/FormActions';
import {SECTION_LABEL} from '@/admin/styles';
import {api, unwrap} from '@/api/client';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

const MIN_PASSWORD_LENGTH = 8;
const MAX_WINDOW_DAYS = 365;

function fetchSettings() {
  return unwrap(api.GET('/admin/organization'));
}

type Part = 'details' | 'languages' | 'rules';

type SettingsUpdate = {
  name?: string;
  bookingWindowDays?: number;
  locales?: Locale[];
  rulesText?: LocalizedText;
};

type PartProps = {
  // Saved from this form since the page opened. The form starts over from
  // what the server has once saved, so the parent remembers it.
  saved: boolean;
  onSaved: () => void;
};

// Each part of the settings is saved on its own, so a save sends only what
// its own form shows. Says whether it was saved, so the form can take what
// it sent as saved before the server's copy comes back.
function useSave(onSaved: () => void) {
  const t = useMessages();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const save = async (body: SettingsUpdate): Promise<boolean> => {
    setError(null);
    setSubmitting(true);
    try {
      await unwrap(api.PATCH('/admin/organization', {body}));
      onSaved();
      setSubmitting(false);
      return true;
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
      setSubmitting(false);
      return false;
    }
  };

  return {error, setError, submitting, save};
}

function Section({title, children}: {title: string; children: ReactNode}) {
  const id = useId();

  return (
    <section aria-labelledby={id} className='mb-9'>
      <h2 id={id} className={SECTION_LABEL}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Note({children}: {children: string}) {
  return <p className='text-[13px] leading-5 text-theme-muted'>{children}</p>;
}

function Status({message}: {message: string | null}) {
  return message ? (
    <p role='status' className='text-sm text-theme-ink'>
      {message}
    </p>
  ) : null;
}

function DetailsForm({
  initial,
  saved,
  onSaved,
}: PartProps & {initial: {name: string; bookingWindowDays: number}}) {
  const t = useMessages();
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState(String(initial.bookingWindowDays));
  const [stored, setStored] = useState({
    name: initial.name,
    bookingWindowDays: initial.bookingWindowDays,
  });
  const {error, setError, submitting, save} = useSave(onSaved);

  // 030 is the same 30 days.
  const dirty =
    name.trim() !== stored.name || Number(days) !== stored.bookingWindowDays;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const bookingWindowDays = Number(days);
    if (
      !Number.isInteger(bookingWindowDays) ||
      bookingWindowDays < 1 ||
      bookingWindowDays > MAX_WINDOW_DAYS
    ) {
      setError(t.admin.organization.windowRange(MAX_WINDOW_DAYS));
      return;
    }

    const sent = {name: name.trim(), bookingWindowDays};
    void save(sent).then((done) => done && setStored(sent));
  };

  return (
    <form onSubmit={submit} className='flex flex-col gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        required
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className='flex flex-col gap-2'>
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
        <Note>{t.admin.organization.windowNote}</Note>
      </div>
      <Status
        message={
          // Said until the form is edited again.
          error ?? (saved && !dirty ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        valid={name.trim().length > 0 && days.trim().length > 0}
        submitting={submitting}
      />
    </form>
  );
}

function LanguagesForm({
  initial,
  saved,
  onSaved,
}: PartProps & {initial: Locale[]}) {
  const t = useMessages();
  const [locales, setLocales] = useState(initial);
  const [stored, setStored] = useState(initial);
  const {error, submitting, save} = useSave(onSaved);
  const dirty = locales.join() !== stored.join();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save({locales}).then((done) => done && setStored(locales));
  };

  return (
    <form onSubmit={submit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2.5'>
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
        <Note>{t.admin.organization.languagesNote}</Note>
      </div>
      <Status
        message={error ?? (saved && !dirty ? t.admin.organization.saved : null)}
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        valid
        submitting={submitting}
      />
    </form>
  );
}

function RulesForm({
  initial,
  locales,
  saved,
  onSaved,
}: PartProps & {initial: LocalizedText; locales: Locale[]}) {
  const t = useMessages();
  const [rulesText, setRulesText] = useState<Draft>(initial);
  const [stored, setStored] = useState<Draft>(initial);
  const {error, setError, submitting, save} = useSave(onSaved);
  const rules = trimmedText(rulesText, locales);
  const dirty =
    JSON.stringify(rules) !== JSON.stringify(trimmedText(stored, locales));

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isWrittenOrEmpty(rules, locales)) {
      setError(t.admin.localized.rulesInEvery);
      return;
    }

    void save({rulesText: rules}).then((done) => done && setStored(rules));
  };

  return (
    <form onSubmit={submit} className='flex flex-col gap-4'>
      {locales.map((language) => (
        <label key={language} className='flex flex-col gap-2'>
          {/* One field needs no name under the heading; more are named by
              their language, as the languages above are. */}
          <span
            className={
              locales.length > 1
                ? 'text-[13px] font-medium text-theme-muted'
                : 'sr-only'
            }
          >
            {locales.length > 1
              ? CATALOGS[language].language.name
              : t.admin.organization.rules}
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
      <Note>{t.admin.organization.rulesNote}</Note>
      <Status
        message={error ?? (saved && !dirty ? t.admin.organization.saved : null)}
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        valid
        submitting={submitting}
      />
    </form>
  );
}

function Settings() {
  const t = useMessages();
  const refresh = useRefreshAccount();
  const {data, error, reload} = useFocusLoad(fetchSettings);
  const [saved, setSaved] = useState<Part | null>(null);

  // The languages decide which fields the rules have, and what the other
  // admin pages ask for.
  const savedFrom = (part: Part) => ({
    saved: saved === part,
    onSaved: () => {
      setSaved(part);
      reload();
      refresh();
    },
  });

  if (error && !data) {
    return (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  }

  if (!data) {
    return null;
  }

  // Saved elsewhere since it was opened: a form starts over from what the
  // server has, so a save cannot put the old values back. Each form starts
  // over only when its own part changed.
  return (
    <>
      <Section title={t.admin.organization.settings}>
        <DetailsForm
          key={`${data.name}\n${data.bookingWindowDays}`}
          initial={data}
          {...savedFrom('details')}
        />
      </Section>
      <Section title={t.admin.organization.languages}>
        <LanguagesForm
          key={data.locales.join()}
          initial={data.locales}
          {...savedFrom('languages')}
        />
      </Section>
      <Section title={t.admin.organization.rules}>
        <RulesForm
          // Not the languages: a language saved meanwhile adds or removes a
          // field, and keeps what is being written in the others.
          key={JSON.stringify(data.rulesText)}
          initial={data.rulesText}
          locales={data.locales}
          {...savedFrom('rules')}
        />
      </Section>
    </>
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
    <Section title={t.admin.organization.changePassword}>
      <form
        onSubmit={(event) => void submit(event)}
        className='flex flex-col gap-4'
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
        <div className='flex flex-col gap-2'>
          <FloatingLabelInput
            label={t.admin.organization.repeatPassword}
            type='password'
            autoComplete='new-password'
            required
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
          <Note>{t.admin.organization.passwordNote}</Note>
        </div>
        <Status message={message} />
        <FormActions
          submitLabel={t.admin.organization.changePassword}
          dirty={current.length > 0 || next.length > 0 || repeat.length > 0}
          valid={current.length > 0 && next.length > 0 && repeat.length > 0}
          submitting={submitting}
        />
      </form>
    </Section>
  );
}

export function AdminOrganization() {
  const account = useAdminAccount();
  const t = useMessages();

  return (
    <AdminPage title={t.tabs.organization} subtitle={account.organizationName}>
      {/* The account keeps the room it has on the apartment's page; the
          sections here are further apart. */}
      <div className='mb-2.5'>
        <Account
          signOutFrom={account.organizationName}
          onSignOut={signOutAdmin}
        />
      </div>
      <Settings />
      <ChangePassword />
    </AdminPage>
  );
}
