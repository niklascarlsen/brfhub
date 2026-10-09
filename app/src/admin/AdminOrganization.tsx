import {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {PRIMARY_BUTTON, PRIMARY_LABEL, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import theme from '@/theme.json';

const MIN_PASSWORD_LENGTH = 8;
const MAX_WINDOW_DAYS = 365;

function fetchSettings() {
  return unwrap(api.GET('/admin/organization'));
}

type SettingsFields = {
  name: string;
  bookingWindowDays: number;
  rulesText: string;
};

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: SettingsFields;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState(String(initial.bookingWindowDays));
  const [rulesText, setRulesText] = useState(initial.rulesText);
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
      setMessage(`Bokningsfönstret är 1 till ${MAX_WINDOW_DAYS} dagar`);
      return;
    }

    setSubmitting(true);
    try {
      await unwrap(
        api.PATCH('/admin/organization', {
          body: {name: name.trim(), bookingWindowDays, rulesText},
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
    <View className='gap-3'>
      <FloatingLabelInput
        label='Föreningens namn'
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <FloatingLabelInput
        label='Bokningsbart antal dagar framåt'
        value={days}
        onChangeText={setDays}
        keyboardType='number-pad'
        maxLength={3}
      />
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        Ett längre fönster öppnar fler dagar direkt. Ett kortare tar inte bort
        bokningar som redan är gjorda.
      </Text>
      <View className='mt-2 gap-1.5'>
        <Text className='text-[13px] font-medium text-theme-muted'>
          Ordningsregler
        </Text>
        <TextInput
          value={rulesText}
          onChangeText={setRulesText}
          multiline
          maxLength={4000}
          textAlignVertical='top'
          placeholder='Till exempel: Städa efter dig. Tyst efter klockan 22.'
          placeholderTextColor={theme.faint}
          accessibilityLabel='Ordningsregler'
          className='min-h-[120px] rounded-sm border border-theme-edge bg-theme-surface px-4 py-3 text-base text-theme-ink'
          style={{fontFamily: 'Merriweather_400Regular', color: theme.ink}}
        />
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          Visas för lägenheterna ovanför tiderna och gränserna.
        </Text>
      </View>
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
        <Text className={PRIMARY_LABEL}>Spara</Text>
      </Pressable>
    </View>
  );
}

function Settings() {
  const refresh = useRefreshAccount();
  const {data, error, reload} = useFocusLoad(fetchSettings);

  return (
    <View className='mb-[26px]'>
      <Text className={SECTION_LABEL}>Inställningar</Text>
      {data ? (
        <SettingsForm initial={data} onSaved={refresh} />
      ) : error ? (
        <Notice message={error} actionLabel='Försök igen' onAction={reload} />
      ) : null}
    </View>
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

  const canSubmit =
    !submitting && current.length > 0 && next.length > 0 && repeat.length > 0;

  async function submit() {
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
    <View>
      <Text className={SECTION_LABEL}>Byt lösenord</Text>
      <View className='gap-3'>
        <FloatingLabelInput
          label='Nuvarande lösenord'
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete='current-password'
          textContentType='password'
        />
        <FloatingLabelInput
          label='Nytt lösenord'
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete='new-password'
          textContentType='newPassword'
        />
        <FloatingLabelInput
          label='Nytt lösenord igen'
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoComplete='new-password'
          textContentType='newPassword'
        />
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          Byt lösenord när styrelsen byts. Alla andra enheter loggas ut.
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
          <Text className={PRIMARY_LABEL}>Byt lösenord</Text>
        </Pressable>
      </View>
    </View>
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
