import {codeOf, errorMessage} from '@booking/core/api/errors';
import {
  codeFailure,
  nextStep,
  passwordFailure,
  type LoginStep,
} from '@booking/core/auth/login';
import {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap} from '@/api/client';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

// The seeded apartment and admin password, so a development build signs
// in with a couple of taps. The apartment's code is read in Mailpit.
const DEV_EMAIL = __DEV__ ? '12@example.com' : '';
const DEV_PASSWORD = __DEV__ ? 'password' : '';

const BUTTON =
  'h-14 items-center justify-center rounded-sm bg-theme-ink active:opacity-70 disabled:opacity-50';
const BUTTON_LABEL =
  'text-base font-semibold tracking-tight text-theme-surface';
const LINK = 'self-start py-2 active:opacity-60';
const LINK_LABEL = 'text-sm font-semibold text-theme-accent';

// Signing in is two steps: the address, then the code it is mailed or, for
// an admin, the password. On success useSession updates and the gate
// unmounts this screen.
export function LoginScreen() {
  const t = useMessages();
  const [step, setStep] = useState<LoginStep>({kind: 'email'});
  const [email, setEmail] = useState(DEV_EMAIL);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(address: string): Promise<boolean> {
    // Better Auth throws rather than answers when the network fails.
    const result = await authClient.emailOtp
      .sendVerificationOtp({email: address, type: 'sign-in'})
      .catch(() => null);

    if (result === null || result.error) {
      setError(codeFailure(result?.error ?? null, t));
      return false;
    }

    return true;
  }

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    await action();
    setSubmitting(false);
  }

  const continueWithEmail = () =>
    run(async () => {
      let next: LoginStep;
      try {
        next = await nextStep({api, unwrap}, email);
      } catch (failure) {
        setError(errorMessage(codeOf(failure), t));
        return;
      }

      if (next.kind === 'code' && !(await sendCode(next.email))) {
        return;
      }

      setCode('');
      setStep(next);
    });

  const signInWithCode = (address: string) =>
    run(async () => {
      const result = await authClient.signIn
        .emailOtp({email: address, otp: code.trim()})
        .catch(() => null);

      if (result === null || result.error) {
        setError(codeFailure(result?.error ?? null, t));
      }
    });

  const signInWithPassword = (address: string) =>
    run(async () => {
      const result = await authClient.signIn
        .email({email: address, password})
        .catch(() => null);

      if (result === null || result.error) {
        setError(passwordFailure(result?.error ?? null, t));
      }
    });

  const resendCode = (address: string) =>
    run(async () => {
      if (await sendCode(address)) {
        setCode('');
        setNotice(t.login.codeSent);
      }
    });

  const backToEmail = () => {
    setStep({kind: 'email'});
    setError(null);
    setNotice(null);
  };

  const problem = error ? (
    <Text
      accessibilityRole='alert'
      className='mb-4 font-sans text-sm text-theme-ink'
    >
      {error}
    </Text>
  ) : notice ? (
    <Text className='mb-4 font-sans text-sm text-theme-muted'>{notice}</Text>
  ) : null;

  let body;
  if (step.kind === 'email') {
    const canSubmit = email.trim().length > 0 && !submitting;

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.title}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.login.intro}
        </Text>
        <FloatingLabelInput
          className='mb-5'
          label={t.common.email}
          value={email}
          onChangeText={setEmail}
          autoCapitalize='none'
          autoComplete='email'
          autoCorrect={false}
          keyboardType='email-address'
          textContentType='emailAddress'
          returnKeyType='go'
          onSubmitEditing={() => canSubmit && void continueWithEmail()}
        />
        {problem}
        <Pressable
          onPress={() => void continueWithEmail()}
          disabled={!canSubmit}
          className={BUTTON}
        >
          <Text className={BUTTON_LABEL}>{t.login.continue}</Text>
        </Pressable>
      </>
    );
  } else if (step.kind === 'code') {
    const canSubmit = code.trim().length > 0 && !submitting;

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.codeTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.login.codeIntro(step.email)}
        </Text>
        <FloatingLabelInput
          className='mb-5'
          label={t.login.code}
          value={code}
          onChangeText={setCode}
          autoFocus
          autoComplete='one-time-code'
          keyboardType='number-pad'
          textContentType='oneTimeCode'
          returnKeyType='go'
          onSubmitEditing={() => canSubmit && void signInWithCode(step.email)}
        />
        {problem}
        <Pressable
          onPress={() => void signInWithCode(step.email)}
          disabled={!canSubmit}
          className={BUTTON}
        >
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row gap-6'>
          <Pressable
            onPress={() => void resendCode(step.email)}
            disabled={submitting}
            className={LINK}
          >
            <Text className={LINK_LABEL}>{t.login.sendNewCode}</Text>
          </Pressable>
          <Pressable onPress={backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.changeEmail}</Text>
          </Pressable>
        </View>
      </>
    );
  } else {
    const canSubmit = password.length > 0 && !submitting;

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.passwordTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.login.passwordIntro(step.email)}
        </Text>
        <FloatingLabelInput
          className='mb-5'
          label={t.login.password}
          value={password}
          onChangeText={setPassword}
          autoFocus
          secureTextEntry
          autoComplete='current-password'
          textContentType='password'
          returnKeyType='go'
          onSubmitEditing={() =>
            canSubmit && void signInWithPassword(step.email)
          }
        />
        {problem}
        <Pressable
          onPress={() => void signInWithPassword(step.email)}
          disabled={!canSubmit}
          className={BUTTON}
        >
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row'>
          <Pressable onPress={backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.changeEmail}</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView className='flex-1 bg-theme-bg'>
      <KeyboardAvoidingView
        className='flex-1 justify-center px-5 pb-16'
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* One view for the keyboard to move. As separate children each
            field got its own layout animation, and the focused field could
            jump ahead of the rest onto the title. */}
        <View key={step.kind}>{body}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
