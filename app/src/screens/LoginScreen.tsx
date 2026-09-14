import {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';

const FIELD =
  'h-12 rounded-xl border border-theme-edge bg-theme-surface px-4 text-base text-theme-ink';

// The rate limiter answers 429 without a code, so status is what tells
// the cases apart.
function loginMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Fel e-post eller lösenord';
    case 429:
      return 'För många försök, vänta en stund';
    case 403:
      return 'Servern tillåter inte den här adressen';
    default:
      return errorMessage('NETWORK');
  }
}

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.length > 0 && password.length > 0 && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);

    const result = await authClient.signIn.email({email, password});

    if (result.error) {
      setError(loginMessage(result.error.status));
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
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Logga in
        </Text>
        <Text className='mb-6 text-sm leading-5 text-theme-muted'>
          Med e-posten som är kopplad till din lägenhet.
        </Text>
        <View className='mb-3 gap-1.5'>
          <Text className='ml-0.5 text-[13px] font-medium text-theme-muted'>
            E-post
          </Text>
          <TextInput
            className={FIELD}
            value={email}
            onChangeText={setEmail}
            autoCapitalize='none'
            autoComplete='email'
            autoCorrect={false}
            keyboardType='email-address'
            textContentType='emailAddress'
            returnKeyType='next'
          />
        </View>
        <View className='mb-5 gap-1.5'>
          <Text className='ml-0.5 text-[13px] font-medium text-theme-muted'>
            Lösenord
          </Text>
          <TextInput
            className={FIELD}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete='current-password'
            textContentType='password'
            returnKeyType='go'
            onSubmitEditing={() => canSubmit && void submit()}
          />
        </View>
        {error ? (
          <Text
            accessibilityRole='alert'
            className='mb-4 text-sm text-theme-ink'
          >
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          className='h-12 items-center justify-center rounded-full bg-theme-ink active:opacity-70 disabled:opacity-50'
        >
          <Text className='text-base font-semibold tracking-tight text-theme-surface'>
            Logga in
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
