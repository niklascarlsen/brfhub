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
import {CATALOGS, LOCALES, type Locale} from '@booking/core/i18n/catalog';
import {useState, type ReactNode} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

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
import theme from '@/theme.json';

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
  return (
    <View className='mb-[36px]'>
      <Text accessibilityRole='header' className={SECTION_LABEL}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Note({children}: {children: string}) {
  return (
    <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
      {children}
    </Text>
  );
}

function Status({message}: {message: string | null}) {
  return message ? (
    <Text
      accessibilityRole='alert'
      className='font-sans text-sm text-theme-ink'
    >
      {message}
    </Text>
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

  const submit = () => {
    if (!ready()) {
      return;
    }

    const sent = checked.value;
    void save(sent).then((done) => done && setStored(sent));
  };

  return (
    <View className='gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        value={name}
        onChangeText={setName}
        onBlur={() => leave('name')}
        problem={problem('name')}
      />
      <View className='gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.windowDays}
          value={days}
          onChangeText={setDays}
          onBlur={() => leave('days')}
          problem={problem('days')}
          keyboardType='number-pad'
        />
        <Note>{t.admin.organization.windowNote}</Note>
      </View>
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
        onSubmit={submit}
      />
    </View>
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

  return (
    <View className='gap-4'>
      <View className='gap-2.5'>
        <View className='flex-row flex-wrap gap-2'>
          {LOCALES.map((language) => {
            const selected = locales.includes(language);

            return (
              <Pressable
                key={language}
                accessibilityRole='button'
                accessibilityState={{selected}}
                // The organization writes in at least one language.
                disabled={selected && locales.length === 1}
                onPress={() =>
                  setLocales(
                    LOCALES.filter((item) =>
                      item === language ? !selected : locales.includes(item),
                    ),
                  )
                }
                className={`h-10 justify-center rounded-full border px-4 ${
                  selected
                    ? 'border-theme-ink bg-theme-ink'
                    : 'border-theme-edge bg-theme-surface active:bg-theme-sunk'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? 'text-theme-surface' : 'text-theme-ink'
                  }`}
                >
                  {CATALOGS[language].language.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Note>{t.admin.organization.languagesNote}</Note>
      </View>
      <Status
        message={
          // Said until the form is edited again.
          error ?? (saved && !dirty ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        submitting={submitting}
        onSubmit={() =>
          void save({locales}).then((done) => done && setStored(locales))
        }
      />
    </View>
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

  const submit = () => {
    if (!ready()) {
      return;
    }

    const rules = checked.value;
    void save({rulesText: rules}).then((done) => done && setStored(rules));
  };

  return (
    <View className='gap-4'>
      {locales.map((language) => {
        // One field needs no name under the heading; more are named by
        // their language, as the languages above are.
        const label =
          locales.length > 1
            ? CATALOGS[language].language.name
            : t.admin.organization.rules;
        const shown = problem(`rules.${language}`);

        return (
          <View key={language}>
            <View className='gap-2'>
              {locales.length > 1 ? (
                <Text className='text-[13px] font-medium text-theme-muted'>
                  {label}
                </Text>
              ) : null}
              <TextInput
                value={rulesText[language] ?? ''}
                onChangeText={(text) =>
                  setRulesText({...rulesText, [language]: text})
                }
                onBlur={() => leave(`rules.${language}`)}
                multiline
                textAlignVertical='top'
                placeholder={t.admin.organization.rulesPlaceholder}
                placeholderTextColor={theme.faint}
                accessibilityLabel={label}
                accessibilityHint={shown ?? undefined}
                className={`min-h-[132px] rounded-sm border bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink ${
                  shown ? 'border-theme-danger' : 'border-theme-edge'
                }`}
                style={{
                  fontFamily: 'Merriweather_400Regular',
                  color: theme.ink,
                }}
              />
            </View>
            {shown ? <FieldProblem message={shown} /> : null}
          </View>
        );
      })}
      <Note>{t.admin.organization.rulesNote}</Note>
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
        onSubmit={submit}
      />
    </View>
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

  async function submit() {
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
      <View className='gap-4'>
        <FloatingLabelInput
          label={t.admin.organization.currentPassword}
          value={fields.current}
          onChangeText={set('current')}
          onBlur={() => leave('current')}
          problem={problem('current')}
          secureTextEntry
          autoComplete='current-password'
          textContentType='password'
        />
        <FloatingLabelInput
          label={t.admin.organization.newPassword}
          value={fields.next}
          onChangeText={set('next')}
          onBlur={() => leave('next')}
          problem={problem('next')}
          secureTextEntry
          autoComplete='new-password'
          textContentType='newPassword'
        />
        <View className='gap-2'>
          <FloatingLabelInput
            label={t.admin.organization.repeatPassword}
            value={fields.repeat}
            onChangeText={set('repeat')}
            onBlur={() => leave('repeat')}
            problem={problem('repeat')}
            secureTextEntry
            autoComplete='new-password'
            textContentType='newPassword'
          />
          <Note>{t.admin.organization.passwordNote}</Note>
        </View>
        <Status message={message} />
        <FormActions
          submitLabel={t.admin.organization.changePassword}
          dirty={checked.changed}
          submitting={submitting}
          onSubmit={() => void submit()}
        />
      </View>
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
      <View className='mb-[10px]'>
        <Account
          signOutFrom={account.organizationName}
          onSignOut={signOutAdmin}
          switchTo={
            account.apartment === null
              ? null
              : {
                  label: t.account.openBooking,
                  onPress: () => switchMode('member'),
                }
          }
        />
      </View>
      <Settings />
      <ChangePassword />
    </AdminPage>
  );
}
