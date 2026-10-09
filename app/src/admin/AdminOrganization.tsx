import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {useAdminAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {PRIMARY_BUTTON, PRIMARY_LABEL, SECTION_LABEL} from '@/admin/styles';
import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';

const MIN_PASSWORD_LENGTH = 8;

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
      <ChangePassword />
    </AdminPage>
  );
}
