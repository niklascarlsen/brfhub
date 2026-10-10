import {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {
  fieldLabel,
  isWrittenOrEmpty,
  trimmedText,
  type Draft,
} from '@/admin/localized';
import {PRIMARY_BUTTON, PRIMARY_LABEL, SECTION_LABEL} from '@/admin/styles';
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

  async function submit() {
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
    <View className='gap-3'>
      <FloatingLabelInput
        label={t.admin.organization.name}
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <FloatingLabelInput
        label={t.admin.organization.windowDays}
        value={days}
        onChangeText={setDays}
        keyboardType='number-pad'
        maxLength={3}
      />
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        {t.admin.organization.windowNote}
      </Text>
      <View className='mt-2 gap-2'>
        <Text className='text-[13px] font-medium text-theme-muted'>
          {t.admin.organization.languages}
        </Text>
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
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {t.admin.organization.languagesNote}
        </Text>
      </View>
      {locales.map((language) => {
        const label = fieldLabel(
          t.admin.organization.rules,
          language,
          locales,
          t,
        );

        return (
          <View key={language} className='mt-2 gap-1.5'>
            <Text className='text-[13px] font-medium text-theme-muted'>
              {label}
            </Text>
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
              className='min-h-[120px] rounded-sm border border-theme-edge bg-theme-surface px-4 py-3 text-base text-theme-ink'
              style={{fontFamily: 'Merriweather_400Regular', color: theme.ink}}
            />
          </View>
        );
      })}
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        {t.admin.organization.rulesNote}
      </Text>
      {message ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {message}
        </Text>
      ) : null}
      <Pressable
        onPress={() => void submit()}
        disabled={submitting || name.trim().length === 0}
        className={`${PRIMARY_BUTTON} mt-2 self-start`}
      >
        <Text className={PRIMARY_LABEL}>{t.admin.save}</Text>
      </Pressable>
    </View>
  );
}

function Settings() {
  const t = useMessages();
  const refresh = useRefreshAccount();
  const {data, error, reload} = useFocusLoad(fetchSettings);

  return (
    <View className='mb-[26px]'>
      <Text className={SECTION_LABEL}>{t.admin.organization.settings}</Text>
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
    </View>
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

  const canSubmit =
    !submitting && current.length > 0 && next.length > 0 && repeat.length > 0;

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
    <View>
      <Text className={SECTION_LABEL}>
        {t.admin.organization.changePassword}
      </Text>
      <View className='gap-3'>
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
        <FloatingLabelInput
          label={t.admin.organization.repeatPassword}
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoComplete='new-password'
          textContentType='newPassword'
        />
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {t.admin.organization.passwordNote}
        </Text>
        {message ? (
          <Text
            accessibilityRole='alert'
            className='font-sans text-sm text-theme-ink'
          >
            {message}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          className={`${PRIMARY_BUTTON} mt-2 self-start`}
        >
          <Text className={PRIMARY_LABEL}>
            {t.admin.organization.changePassword}
          </Text>
        </Pressable>
      </View>
    </View>
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
