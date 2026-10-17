import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import type {SettingsUpdate} from '@booking/core/admin/actions';
import {
  checkDetails,
  checkRules,
  failureMessage,
  isSame,
} from '@booking/core/admin/drafts';
import type {Draft} from '@booking/core/admin/localized';
import {useProblems} from '@booking/core/admin/useProblems';
import {useSwitchMode} from '@booking/core/auth/mode';
import {useChangePassword} from '@booking/core/auth/useChangePassword';
import {describeEvent, formatEventTime} from '@booking/core/admin/events';
import type {OrganizationSection} from '@booking/core/admin/location';
import type {
  AdminUser,
  EventPage,
  LocalizedText,
  OrganizationSettings,
} from '@booking/core/api/types';
import {limits} from '@booking/core/generated/limits';
import {
  CATALOGS,
  joinNames,
  LOCALES,
  localize,
  type Locale,
  type Messages,
} from '@booking/core/i18n/catalog';
import {useId, useState, type ReactNode, type SubmitEvent} from 'react';

import {AdminPage} from '@/admin/AdminPage';
import {AdminDetail, Admins} from '@/admin/Admins';
import {FormActions} from '@/admin/FormActions';
import {Gone} from '@/admin/Gone';
import {History} from '@/admin/History';
import {useAdminLocation} from '@/admin/location';
import {ActionRow, Badge} from '@/admin/Rows';
import {LIST, SECTION_LABEL} from '@/admin/styles';
import {useConfirmLeave} from '@/admin/unsaved';
import {authClient} from '@/auth/client';
import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import {useIsDesktop} from '@/lib/media';

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

// A new password signs out every other device signed in to the account.
// Better Auth changes it, outside the admin's API.
function ChangePassword() {
  const t = useMessages();
  const change = useChangePassword({auth: authClient, t});
  const {fields, problem, leave} = change;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void change.submit();
  }

  return (
    <form noValidate onSubmit={submit} className='flex flex-col gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.currentPassword}
        type='password'
        autoComplete='current-password'
        required
        value={fields.current}
        onChange={(event) => change.edit('current', event.target.value)}
        onBlur={() => leave('current')}
        problem={problem('current')}
      />
      <FloatingLabelInput
        label={t.admin.organization.newPassword}
        type='password'
        autoComplete='new-password'
        required
        value={fields.next}
        onChange={(event) => change.edit('next', event.target.value)}
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
          onChange={(event) => change.edit('repeat', event.target.value)}
          onBlur={() => leave('repeat')}
          problem={problem('repeat')}
        />
        <Note>{t.admin.organization.passwordNote}</Note>
      </div>
      <Status message={change.message} />
      <FormActions
        submitLabel={t.admin.organization.changePassword}
        dirty={change.changed}
        submitting={change.submitting}
      />
    </form>
  );
}

type Page = OrganizationSection;

const ORGANIZATION_PAGES = [
  'details',
  'languages',
  'rules',
  'admins',
  'history',
] as const satisfies readonly Page[];

function titleOf(page: Page, t: Messages): string {
  switch (page) {
    case 'details':
      return t.admin.details;
    case 'languages':
      return t.admin.organization.languages;
    case 'rules':
      return t.admin.organization.rules;
    case 'admins':
      return t.admin.admins.title;
    case 'history':
      return t.admin.events.title;
    case 'password':
      return t.admin.organization.changePassword;
    case 'account':
      return t.account.heading;
  }
}

// What is loaded and how the page answers while it is not: nothing yet, or
// the failure with a way to try again.
function Loaded<T>({
  state,
  children,
}: {
  state: {data: T | null; error: string | null; reload: () => void};
  children: (data: T) => ReactNode;
}) {
  const t = useMessages();

  if (state.error && !state.data) {
    return (
      <Notice
        message={state.error}
        actionLabel={t.common.retry}
        onAction={state.reload}
      />
    );
  }

  return state.data ? children(state.data) : null;
}

// A group of the menu, heading its pages like a page heads its content.
const MENU_HEADING =
  'mb-2 ml-3 text-base font-semibold tracking-tight text-theme-ink';

// The desktop's menu of the organization's pages, beside the one shown.
function PageMenu({
  shown,
  attention,
  onOpen,
}: {
  shown: Page;
  attention: number;
  onOpen: (page: Page) => void;
}) {
  const t = useMessages();

  const link = (page: Page) => (
    <button
      key={page}
      type='button'
      aria-current={page === shown ? 'page' : undefined}
      onClick={() => onOpen(page)}
      className={`flex h-10 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm transition-colors ${
        page === shown
          ? 'bg-theme-surface font-semibold text-theme-ink shadow-[0_0_0_1px_var(--color-theme-line)]'
          : 'font-medium text-theme-muted hover:text-theme-ink'
      }`}
    >
      {titleOf(page, t)}
      {page === 'admins' && attention > 0 ? (
        <Badge>{String(attention)}</Badge>
      ) : null}
    </button>
  );

  return (
    <nav aria-label={t.admin.organization.pages} className='flex flex-col'>
      <h2 className={MENU_HEADING}>{t.tabs.organization}</h2>
      {ORGANIZATION_PAGES.map(link)}
      {/* The account and its password on one page, apart from the
          organization's, as a button so signing out is easy to find. */}
      <button
        type='button'
        aria-current={shown === 'account' ? 'page' : undefined}
        onClick={() => onOpen('account')}
        className={`mt-7 flex h-10 items-center rounded-full border px-4 text-left text-sm font-semibold tracking-tight text-theme-ink transition-colors ${
          shown === 'account'
            ? 'border-theme-ink bg-theme-surface'
            : 'border-theme-edge bg-theme-surface hover:bg-theme-sunk'
        }`}
      >
        {titleOf('account', t)}
      </button>
    </nav>
  );
}

// The phone's way in: each page as a row that says what is on it now.
function Overview({
  organization,
  admins,
  latest,
  onOpen,
  account,
}: {
  organization: OrganizationSettings | null;
  admins: AdminUser[] | null;
  // The newest page of the history, a single event.
  latest: EventPage | null;
  onOpen: (page: Page) => void;
  account: ReactNode;
}) {
  const t = useMessages();
  const {locale} = useLocale();
  const attention =
    admins?.filter((admin) => !admin.twoFactorEnabled).length ?? 0;
  const newest = latest?.events[0];
  const rules = organization
    ? localize(organization.rulesText, locale)?.trim().split('\n')[0]
    : undefined;

  const summaries: Record<(typeof ORGANIZATION_PAGES)[number], string> = {
    details: organization
      ? t.admin.organization.windowSummary(
          organization.name,
          organization.bookingWindowDays,
        )
      : '',
    languages: organization
      ? joinNames(
          organization.locales.map(
            (language) => CATALOGS[language].language.name,
          ),
          t,
        )
      : '',
    rules: organization ? rules || t.admin.organization.noRules : '',
    admins: admins ? t.admin.admins.count(admins.length) : '',
    history: !latest
      ? ''
      : newest
        ? `${describeEvent(newest, t)} · ${formatEventTime(newest.at, t)}`
        : t.admin.events.none,
  };

  return (
    <>
      <section className='mb-6.5'>
        <h2 className={SECTION_LABEL}>{t.tabs.organization}</h2>
        <div className={LIST}>
          {ORGANIZATION_PAGES.map((page) => (
            <ActionRow
              key={page}
              label={titleOf(page, t)}
              description={summaries[page]}
              badge={
                page === 'admins' && attention > 0 ? (
                  <Badge>{t.admin.admins.withoutTwoFactor(attention)}</Badge>
                ) : undefined
              }
              onPress={() => onOpen(page)}
            />
          ))}
        </div>
      </section>
      {account}
    </>
  );
}

export function AdminOrganization() {
  const account = useAdminAccount();
  const refresh = useRefreshAccount();
  const switchMode = useSwitchMode();
  const confirmLeave = useConfirmLeave();
  const isDesktop = useIsDesktop();
  const t = useMessages();
  const passwordId = useId();
  const organization = useFocusLoad(adminLoad.organization);
  const admins = useFocusLoad(adminLoad.admins);
  const newestEvent = useFocusLoad(adminLoad.newestEvent);
  const {location, open: go, up: goUp} = useAdminLocation('organization');
  const [saved, setSaved] = useState<Part | null>(null);

  // Every change is in the history the next time it is opened.
  const reloadEvents = newestEvent.reload;
  const reloadAdmins = admins.reload;
  const adminsChanged = () => {
    reloadAdmins();
    reloadEvents();
  };

  // The languages decide which fields the rules have, and what the other
  // admin pages ask for.
  const savedFrom = (part: Part) => ({
    saved: saved === part,
    onSaved: () => {
      setSaved(part);
      organization.reload();
      reloadEvents();
      refresh();
    },
  });

  // "Sparat." is said on the page it was saved from, until another opens.
  const open = (page: Page | null) => {
    setSaved(null);
    go({tab: 'organization', step: page ?? 'overview'});
  };
  const up = () => {
    setSaved(null);
    goUp();
  };

  // The desktop always shows a page beside its menu, and the password on
  // the account's; the phone starts at the overview, which holds the
  // account, and opens the password from it.
  const page: Page | null =
    location.step === 'admin'
      ? 'admins'
      : location.step === 'overview'
        ? isDesktop
          ? 'details'
          : null
        : location.step === 'password' && isDesktop
          ? 'account'
          : location.step;
  const adminId = location.step === 'admin' ? location.id : null;
  const openedAdmin =
    adminId === null
      ? undefined
      : admins.data?.find((admin) => admin.id === adminId);
  const attention =
    admins.data?.filter((admin) => !admin.twoFactorEnabled).length ?? 0;

  const accountCard = (
    <Account
      signOutFrom={account.organizationName}
      onSignOut={signOut}
      switchTo={
        account.apartment === null
          ? null
          : {
              label: t.account.openBooking,
              route: 'book',
              onPress: () => switchMode('member'),
            }
      }
    >
      {isDesktop ? null : (
        <div className={`mt-2.5 ${LIST}`}>
          <ActionRow
            label={t.admin.organization.changePassword}
            onPress={() => open('password')}
          />
        </div>
      )}
    </Account>
  );

  let content: ReactNode;
  switch (page) {
    case null:
      content = (
        <Overview
          organization={organization.data}
          admins={admins.data}
          latest={newestEvent.data}
          onOpen={open}
          account={accountCard}
        />
      );
      break;
    case 'account':
      // As wide as the password's form under it.
      content = isDesktop ? (
        <div className='flex max-w-2xl flex-col'>
          {accountCard}
          <section aria-labelledby={passwordId}>
            <h2 id={passwordId} className={SECTION_LABEL}>
              {t.admin.organization.changePassword}
            </h2>
            <ChangePassword />
          </section>
        </div>
      ) : (
        accountCard
      );
      break;
    case 'details':
      // Saved elsewhere since it was opened: a form starts over from what
      // the server has, so a save cannot put the old values back. Each
      // form starts over only when its own part changed.
      content = (
        <Loaded state={organization}>
          {(data) => (
            <DetailsForm
              key={`${data.name}\n${data.bookingWindowDays}`}
              initial={data}
              {...savedFrom('details')}
            />
          )}
        </Loaded>
      );
      break;
    case 'languages':
      content = (
        <Loaded state={organization}>
          {(data) => (
            <LanguagesForm
              key={data.locales.join()}
              initial={data.locales}
              {...savedFrom('languages')}
            />
          )}
        </Loaded>
      );
      break;
    case 'rules':
      content = (
        <Loaded state={organization}>
          {(data) => (
            <RulesForm
              // Not the languages: a language saved meanwhile adds or
              // removes a field, and keeps what is being written in the
              // others.
              key={JSON.stringify(data.rulesText)}
              initial={data.rulesText}
              locales={data.locales}
              {...savedFrom('rules')}
            />
          )}
        </Loaded>
      );
      break;
    case 'admins':
      content = openedAdmin ? (
        <AdminDetail
          key={openedAdmin.id}
          admin={openedAdmin}
          onChanged={adminsChanged}
          onRemoved={up}
        />
      ) : adminId !== null ? (
        <Loaded state={admins}>
          {() => (admins.loading ? null : <Gone />)}
        </Loaded>
      ) : (
        <Loaded state={admins}>
          {(data) => (
            <Admins
              admins={data}
              onChanged={adminsChanged}
              onOpen={(admin) =>
                go({tab: 'organization', step: 'admin', id: admin.id})
              }
            />
          )}
        </Loaded>
      );
      break;
    case 'history':
      content = <History />;
      break;
    case 'password':
      content = <ChangePassword />;
      break;
  }

  const back =
    adminId !== null
      ? {label: t.admin.admins.title, onPress: up}
      : page !== null && !isDesktop
        ? {label: t.tabs.organization, onPress: up}
        : undefined;

  return (
    <AdminPage
      title={
        adminId !== null
          ? (openedAdmin?.name ??
            (admins.data && !admins.loading ? t.admin.goneTitle : ''))
          : page === null
            ? t.tabs.organization
            : titleOf(page, t)
      }
      subtitle={account.organizationName}
      back={back}
      aside={
        isDesktop && page !== null ? (
          <PageMenu
            shown={page}
            attention={attention}
            onOpen={(next) => confirmLeave(() => open(next))}
          />
        ) : undefined
      }
    >
      {content}
    </AdminPage>
  );
}
