import {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import type {Messages} from '@/i18n/catalog';
import {useMessages} from '@/i18n/LocaleProvider';

// The rate limiter answers 429 without a code, so status is what tells
// the cases apart.
function loginMessage(status: number, t: Messages): string {
  switch (status) {
    case 401:
      return t.login.wrongCredentials;
    case 429:
      return t.login.tooManyAttempts;
    case 403:
      return t.login.originRefused;
    default:
      return errorMessage('NETWORK', t);
  }
}

export function LoginScreen() {
  const t = useMessages();
  const [email, setEmail] = useState('12@example.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0 && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);

    // Better Auth throws rather than answers when the network fails.
    const result = await authClient.signIn
      .email({email, password})
      .catch(() => null);

    if (result === null) {
      setError(errorMessage('NETWORK', t));
      setSubmitting(false);
      return;
    }

    if (result.error) {
      setError(loginMessage(result.error.status, t));
      setSubmitting(false);
    }
    // On success useSession updates and the gate unmounts this screen.
  }

  return (
    <SafeAreaView className='flex-1 bg-theme-bg'>
      <KeyboardAvoidingView
        className='flex-1 justify-center px-5 pb-16'
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* One view for the keyboard to move. As separate children each
            field got its own layout animation, and the focused email field
            could jump ahead of the rest onto the title. */}
        <View>
          <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
            {t.login.title}
          </Text>
          <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
            {t.login.intro}
          </Text>
          <FloatingLabelInput
            className='mb-3'
            label={t.common.email}
            value={email}
            onChangeText={setEmail}
            autoCapitalize='none'
            autoComplete='email'
            autoCorrect={false}
            keyboardType='email-address'
            textContentType='emailAddress'
            returnKeyType='next'
          />
          <FloatingLabelInput
            className='mb-5'
            label={t.login.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete='current-password'
            textContentType='password'
            returnKeyType='go'
            onSubmitEditing={() => canSubmit && void submit()}
          />
          {error ? (
            <Text
              accessibilityRole='alert'
              className='mb-4 font-sans text-sm text-theme-ink'
            >
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void submit()}
            disabled={!canSubmit}
            className='h-14 items-center justify-center rounded-sm bg-theme-ink active:opacity-70 disabled:opacity-50'
          >
            <Text className='text-base font-semibold tracking-tight text-theme-surface'>
              {t.login.submit}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
