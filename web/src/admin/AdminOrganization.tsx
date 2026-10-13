import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import type {SettingsUpdate} from '@booking/core/admin/actions';
import {
  checkDetails,
  checkPassword,
  checkRules,
  failureMessage,
  isSame,
  passwordFailure,
} from '@booking/core/admin/drafts';
import type {Draft} from '@booking/core/admin/localized';
import {useProblems} from '@booking/core/admin/useProblems';
import {errorMessage} from '@booking/core/api/errors';
import {useSwitchMode} from '@booking/core/auth/mode';
import type {LocalizedText} from '@booking/core/api/types';
import {limits} from '@booking/core/generated/limits';
import {CATALOGS, LOCALES, type Locale} from '@booking/core/i18n/catalog';
import {useId, useState, type ReactNode, type SubmitEvent} from 'react';

import {AdminPage} from '@/admin/AdminPage';
import {FormActions} from '@/admin/FormActions';
import {SECTION_LABEL} from '@/admin/styles';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

type Part = 'details' | 'languages' | 'rules';

type PartProps = {
  // Saved from this form since the page opened. The form starts over from
  // what the server has once saved, so the parent remembers it.
  saved: boolean;
  onSaved: () => void;
};

// Says whether it was saved, so the form can take what it sent as saved
// before the server's copy comes back.
function useSave(onSaved: () => void) {
  const t = useMessages();
  const actions = useAdminActions(onSaved);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const save = async (body: SettingsUpdate): Promise<boolean> => {
    setError(null);
    setSubmitting(true);
    try {
      await actions.organization.save(body);
      setSubmitting(false);
      return true;
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
      return false;
    }
  };

  return {error, submitting, save};
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
  const {error, submitting, save} = useSave(onSaved);
  const checked = checkDetails({name, days}, stored, t);
  const {problem, leave, ready} = useProblems(checked);
  const {minimum, maximum} = limits.UpdateOrganizationBody.bookingWindowDays;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ready()) {
      return;
    }

    const sent = checked.value;
    void save(sent).then((done) => done && setStored(sent));
  };

  return (
    <form noValidate onSubmit={submit} className='flex flex-col gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        required
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => leave('name')}
        problem={problem('name')}
      />
      <div className='flex flex-col gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.windowDays}
          type='number'
          inputMode='numeric'
          min={minimum}
          max={maximum}
          required
          value={days}
          onChange={(event) => setDays(event.target.value)}
          onBlur={() => leave('days')}
          problem={problem('days')}
        />
        <Note>{t.admin.organization.windowNote}</Note>
      </div>
      <Status
        message={
          // Said until the form is edited again.
          error ??
          (saved && !checked.changed ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={checked.changed}
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
  const dirty = !isSame(locales, stored);

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
  const {error, submitting, save} = useSave(onSaved);
  const checked = checkRules(rulesText, stored, locales, t);
  const {problem, leave, ready} = useProblems(checked);
  const formId = useId();

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ready()) {
      return;
    }

    const rules = checked.value;
    void save({rulesText: rules}).then((done) => done && setStored(rules));
  };

  return (
    <form noValidate onSubmit={submit} className='flex flex-col gap-4'>
      {locales.map((language) => {
        const shown = problem(`rules.${language}`);
        const problemId = `${formId}-${language}`;

        return (
          <div key={language}>
            <label className='flex flex-col gap-2'>
              {/* One field needs no name under the heading; more are named
                  by their language, as the languages above are. */}
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
                rows={5}
                placeholder={t.admin.organization.rulesPlaceholder}
                value={rulesText[language] ?? ''}
                onChange={(event) =>
                  setRulesText({...rulesText, [language]: event.target.value})
                }
                onBlur={() => leave(`rules.${language}`)}
                aria-invalid={shown ? true : undefined}
                aria-describedby={shown ? problemId : undefined}
                className={`w-full rounded-xs border bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink placeholder:text-theme-faint ${
                  shown
                    ? 'border-theme-danger'
                    : 'border-theme-edge focus:border-theme-ink'
                }`}
              />
            </label>
            {shown ? <FieldProblem id={problemId} message={shown} /> : null}
          </div>
        );
      })}
      <Note>{t.admin.organization.rulesNote}</Note>
      <Status
        message={
          error ??
          (saved && !checked.changed ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={checked.changed}
        submitting={submitting}
      />
    </form>
  );
}

function Settings() {
  const t = useMessages();
  const refresh = useRefreshAccount();
  const {data, error, reload} = useFocusLoad(adminLoad.organization);
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

// The admin account is shared by the board, so a new password is how it is
// handed over: every other device signed in to it is signed out. Better
// Auth changes it, outside the admin's API.
function ChangePassword() {
  const t = useMessages();
  const [fields, setFields] = useState({current: '', next: '', repeat: ''});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checked = checkPassword(fields, t);
  const {problem, leave, ready, reset} = useProblems(checked);

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((previous) => ({...previous, [key]: value}));

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!ready()) {
      return;
    }

    setSubmitting(true);
    // Better Auth throws rather than answers when the network fails.
    const result = await authClient
      .changePassword({
        currentPassword: fields.current,
        newPassword: fields.next,
        revokeOtherSessions: true,
      })
      .catch(() => null);
    setSubmitting(false);

    if (result === null) {
      setMessage(errorMessage('NETWORK', t));
      return;
    }

    if (result.error) {
      setMessage(passwordFailure(result.error.code, t));
      return;
    }

    setFields({current: '', next: '', repeat: ''});
    reset();
    setMessage(t.admin.organization.passwordChanged);
  }

  return (
    <Section title={t.admin.organization.changePassword}>
      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className='flex flex-col gap-4'
      >
        <FloatingLabelInput
          label={t.admin.organization.currentPassword}
          type='password'
          autoComplete='current-password'
          required
          value={fields.current}
          onChange={(event) => set('current')(event.target.value)}
          onBlur={() => leave('current')}
          problem={problem('current')}
        />
        <FloatingLabelInput
          label={t.admin.organization.newPassword}
          type='password'
          autoComplete='new-password'
          required
          value={fields.next}
          onChange={(event) => set('next')(event.target.value)}
          onBlur={() => leave('next')}
          problem={problem('next')}
        />
        <div className='flex flex-col gap-2'>
          <FloatingLabelInput
            label={t.admin.organization.repeatPassword}
            type='password'
            autoComplete='new-password'
            required
            value={fields.repeat}
            onChange={(event) => set('repeat')(event.target.value)}
            onBlur={() => leave('repeat')}
            problem={problem('repeat')}
          />
          <Note>{t.admin.organization.passwordNote}</Note>
        </div>
        <Status message={message} />
        <FormActions
          submitLabel={t.admin.organization.changePassword}
          dirty={checked.changed}
          submitting={submitting}
        />
      </form>
    </Section>
  );
}

export function AdminOrganization() {
  const account = useAdminAccount();
  const switchMode = useSwitchMode();
  const t = useMessages();

  return (
    <AdminPage title={t.tabs.organization} subtitle={account.organizationName}>
      {/* The account keeps the room it has on the apartment's page; the
          sections here are further apart. */}
      <div className='mb-2.5'>
        <Account
          signOutFrom={account.organizationName}
          onSignOut={signOutAdmin}
          switchTo={
            account.apartment === null
              ? null
              : {
                  label: t.account.openBooking,
                  route: 'book',
                  onPress: () => switchMode('member'),
                }
          }
        />
      </div>
      <Settings />
      <ChangePassword />
    </AdminPage>
  );
}
