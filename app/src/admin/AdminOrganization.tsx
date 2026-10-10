import {useState, type ReactNode} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {FormActions} from '@/admin/FormActions';
import {isWrittenOrEmpty, trimmedText, type Draft} from '@/admin/localized';
import {SECTION_LABEL} from '@/admin/styles';
import {api, unwrap, type LocalizedText} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {CATALOGS, LOCALES, type Locale, type Messages} from '@/i18n/catalog';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

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
  const {error, setError, submitting, save} = useSave(onSaved);

  // 030 is the same 30 days.
  const dirty =
    name.trim() !== stored.name || Number(days) !== stored.bookingWindowDays;

  const submit = () => {
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
    <View className='gap-4'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <View className='gap-2'>
        <FloatingLabelInput
          label={t.admin.organization.windowDays}
          value={days}
          onChangeText={setDays}
          keyboardType='number-pad'
          maxLength={3}
        />
        <Note>{t.admin.organization.windowNote}</Note>
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
        valid={name.trim().length > 0 && days.trim().length > 0}
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
  const dirty = locales.join() !== stored.join();

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
        valid
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
  const {error, setError, submitting, save} = useSave(onSaved);
  const rules = trimmedText(rulesText, locales);
  const dirty =
    JSON.stringify(rules) !== JSON.stringify(trimmedText(stored, locales));

  const submit = () => {
    if (!isWrittenOrEmpty(rules, locales)) {
      setError(t.admin.localized.rulesInEvery);
      return;
    }

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

        return (
          <View key={language} className='gap-2'>
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
              multiline
              maxLength={4000}
              textAlignVertical='top'
              placeholder={t.admin.organization.rulesPlaceholder}
              placeholderTextColor={theme.faint}
              accessibilityLabel={label}
              className='min-h-[132px] rounded-sm border border-theme-edge bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink'
              style={{fontFamily: 'Merriweather_400Regular', color: theme.ink}}
            />
          </View>
        );
      })}
      <Note>{t.admin.organization.rulesNote}</Note>
      <Status
        message={
          // Said until the form is edited again.
          error ?? (saved && !dirty ? t.admin.organization.saved : null)
        }
      />
      <FormActions
        submitLabel={t.admin.save}
        dirty={dirty}
        valid
        submitting={submitting}
        onSubmit={submit}
      />
    </View>
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

  async function submit() {
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
      <View className='gap-4'>
        <FloatingLabelInput
          label={t.admin.organization.currentPassword}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete='current-password'
          textContentType='password'
        />
        <FloatingLabelInput
          label={t.admin.organization.newPassword}
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete='new-password'
          textContentType='newPassword'
        />
        <View className='gap-2'>
          <FloatingLabelInput
            label={t.admin.organization.repeatPassword}
            value={repeat}
            onChangeText={setRepeat}
            secureTextEntry
            autoComplete='new-password'
            textContentType='newPassword'
          />
          <Note>{t.admin.organization.passwordNote}</Note>
        </View>
        <Status message={message} />
        <FormActions
          submitLabel={t.admin.organization.changePassword}
          dirty={current.length > 0 || next.length > 0 || repeat.length > 0}
          valid={current.length > 0 && next.length > 0 && repeat.length > 0}
          submitting={submitting}
          onSubmit={() => void submit()}
        />
      </View>
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
      <View className='mb-[10px]'>
        <Account
          signOutFrom={account.organizationName}
          onSignOut={signOutAdmin}
        />
      </View>
      <Settings />
      <ChangePassword />
    </AdminPage>
  );
}
