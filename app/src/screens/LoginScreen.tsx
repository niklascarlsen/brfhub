import {
  checkPasswordReset,
  type PasswordResetFields,
} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import {codeOf, errorMessage} from '@booking/core/api/errors';
import {
  codeFailure,
  isStaleChallenge,
  nextStep,
  passwordFailure,
  resetFailure,
  totpFailure,
  type LoginStep,
} from '@booking/core/auth/login';
import {limits} from '@booking/core/generated/limits';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {
  KeyboardAvoidingView,
  KeyboardToolbar,
} from 'react-native-keyboard-controller';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap} from '@/api/client';
import {authClient} from '@/auth/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {DEV_EMAIL, DEV_PASSWORD, devCode} from '@/lib/devCodes';
import theme from '@/theme.json';

const BUTTON =
  'h-14 items-center justify-center rounded-sm bg-theme-ink active:opacity-70 disabled:opacity-50';
const BUTTON_LABEL =
  'text-base font-semibold tracking-tight text-theme-surface';
const LINK = 'self-start py-2 active:opacity-60';
const LINK_LABEL = 'text-sm font-semibold text-theme-accent';
const EMPTY_RESET: PasswordResetFields = {code: '', next: '', repeat: ''};

// Signing in is two steps: the address, then the code it is mailed or, for
// an admin, the password. On success useSession updates and the gate
// unmounts this screen.
export function LoginScreen() {
  const t = useMessages();
  const [step, setStep] = useState<LoginStep>({kind: 'email'});
  const [email, setEmail] = useState(DEV_EMAIL);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [trustDevice, setTrustDevice] = useState(true);
  const [reset, setReset] = useState(EMPTY_RESET);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checkedReset = checkPasswordReset(reset, t);
  const resetProblems = useProblems(checkedReset);

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

      if (next.kind === 'reset') {
        await beginReset(next.email);
        return;
      }

      setCode(next.kind === 'code' ? await devCode(next.email, 'mailed') : '');
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

  // An admin with an authenticator is asked for its code next.
  const signInWithPassword = (address: string, secret: string) =>
    run(async () => {
      const result = await authClient.signIn
        .email({email: address, password: secret})
        .catch(() => null);

      if (result === null || result.error) {
        setError(passwordFailure(result?.error ?? null, t));
        return;
      }

      if ('twoFactorRedirect' in result.data) {
        setCode(await devCode(address, 'totp'));
        setStep({kind: 'totp', email: address, backup: false});
      }
    });

  const signInWithTotp = (address: string, backup: boolean) =>
    run(async () => {
      const verify = backup
        ? authClient.twoFactor.verifyBackupCode({
            code: code.trim(),
            trustDevice,
          })
        : authClient.twoFactor.verifyTotp({code: code.trim(), trustDevice});
      const result = await verify.catch(() => null);

      if (result === null || result.error) {
        const failure = result?.error ?? null;
        // Ten minutes passed since the password: back to it.
        if (isStaleChallenge(failure)) {
          setStep({kind: 'password', email: address});
        }
        setError(totpFailure(failure, t));
      }
    });

  // An admin sets or resets the password with a code mailed to them, and
  // is signed in with it at once. A new admin is sent here from the
  // address, one who forgot the password from the password step.
  async function beginReset(address: string): Promise<void> {
    const result = await authClient.emailOtp
      .requestPasswordReset({email: address})
      .catch(() => null);

    if (result === null || result.error) {
      setError(codeFailure(result?.error ?? null, t));
      return;
    }

    setReset({...EMPTY_RESET, code: await devCode(address, 'mailed')});
    resetProblems.reset();
    setStep({kind: 'reset', email: address});
  }

  const startReset = (address: string) => run(() => beginReset(address));

  const finishReset = (address: string) =>
    run(async () => {
      if (!resetProblems.ready()) {
        return;
      }

      const result = await authClient.emailOtp
        .resetPassword({
          email: address,
          otp: checkedReset.value.code,
          password: checkedReset.value.next,
        })
        .catch(() => null);

      if (result === null || result.error) {
        setError(
          resetFailure(
            result?.error ?? null,
            t,
            limits.ChangePasswordBody.newPassword,
          ),
        );
        return;
      }

      setPassword(checkedReset.value.next);
      setStep({kind: 'password', email: address});
      await signInWithPassword(address, checkedReset.value.next);
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
  } else if (step.kind === 'password') {
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
            canSubmit && void signInWithPassword(step.email, password)
          }
        />
        {problem}
        <Pressable
          onPress={() => void signInWithPassword(step.email, password)}
          disabled={!canSubmit}
          className={BUTTON}
        >
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row flex-wrap gap-x-6'>
          <Pressable
            onPress={() => void startReset(step.email)}
            disabled={submitting}
            className={LINK}
          >
            <Text className={LINK_LABEL}>{t.login.setPassword}</Text>
          </Pressable>
          <Pressable onPress={backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.changeEmail}</Text>
          </Pressable>
        </View>
      </>
    );
  } else if (step.kind === 'totp') {
    const canSubmit = code.trim().length > 0 && !submitting;
    const {backup} = step;

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {backup ? t.login.backupTitle : t.login.totpTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {backup ? t.login.backupIntro : t.login.totpIntro}
        </Text>
        <FloatingLabelInput
          className='mb-4'
          label={backup ? t.login.backupCode : t.login.totpCode}
          value={code}
          onChangeText={setCode}
          autoFocus
          autoCapitalize='none'
          autoComplete={backup ? 'off' : 'one-time-code'}
          autoCorrect={false}
          keyboardType={backup ? 'default' : 'number-pad'}
          textContentType={backup ? 'none' : 'oneTimeCode'}
          returnKeyType='go'
          onSubmitEditing={() =>
            canSubmit && void signInWithTotp(step.email, backup)
          }
        />
        <Pressable
          onPress={() => setTrustDevice((value) => !value)}
          accessibilityRole='checkbox'
          accessibilityState={{checked: trustDevice}}
          className='mb-5 flex-row items-center gap-2.5 self-start py-1'
        >
          <Ionicons
            name={trustDevice ? 'checkbox' : 'square-outline'}
            size={22}
            color={trustDevice ? theme.ink : theme.muted}
          />
          <Text className='font-sans text-sm text-theme-ink'>
            {t.login.trustDevice}
          </Text>
        </Pressable>
        {problem}
        <Pressable
          onPress={() => void signInWithTotp(step.email, backup)}
          disabled={!canSubmit}
          className={BUTTON}
        >
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row flex-wrap gap-x-6'>
          <Pressable
            onPress={() => {
              setCode('');
              setError(null);
              setStep({...step, backup: !backup});
            }}
            className={LINK}
          >
            <Text className={LINK_LABEL}>
              {backup ? t.login.useTotp : t.login.useBackupCode}
            </Text>
          </Pressable>
          <Pressable onPress={backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.startOver}</Text>
          </Pressable>
        </View>
      </>
    );
  } else {
    const setField = (key: keyof PasswordResetFields) => (value: string) =>
      setReset((previous) => ({...previous, [key]: value}));

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.login.resetTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.login.resetIntro(step.email)}
        </Text>
        <View className='mb-5 gap-3'>
          <FloatingLabelInput
            label={t.login.code}
            value={reset.code}
            onChangeText={setField('code')}
            onBlur={() => resetProblems.leave('code')}
            problem={resetProblems.problem('code')}
            autoFocus
            autoComplete='one-time-code'
            keyboardType='number-pad'
            textContentType='oneTimeCode'
            returnKeyType='next'
          />
          <FloatingLabelInput
            label={t.login.newPassword}
            value={reset.next}
            onChangeText={setField('next')}
            onBlur={() => resetProblems.leave('next')}
            problem={resetProblems.problem('next')}
            secureTextEntry
            autoComplete='new-password'
            textContentType='newPassword'
            returnKeyType='next'
          />
          <FloatingLabelInput
            label={t.login.repeatPassword}
            value={reset.repeat}
            onChangeText={setField('repeat')}
            onBlur={() => resetProblems.leave('repeat')}
            problem={resetProblems.problem('repeat')}
            secureTextEntry
            autoComplete='new-password'
            textContentType='newPassword'
            returnKeyType='go'
            onSubmitEditing={() => !submitting && void finishReset(step.email)}
          />
        </View>
        {problem}
        <Pressable
          onPress={() => void finishReset(step.email)}
          disabled={submitting}
          className={BUTTON}
        >
          <Text className={BUTTON_LABEL}>{t.login.resetSubmit}</Text>
        </Pressable>
        <View className='mt-3 flex-row flex-wrap gap-x-6'>
          <Pressable
            onPress={() => void startReset(step.email)}
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
  }

  return (
    <SafeAreaView className='flex-1 bg-theme-bg'>
      <KeyboardAvoidingView
        className='flex-1 justify-center px-5 pb-16'
        behavior='padding'
      >
        {/* One view for the keyboard to move. As separate children each
            field got its own layout animation, and the focused field could
            jump ahead of the rest onto the title. */}
        <View key={step.kind}>{body}</View>
      </KeyboardAvoidingView>
      <KeyboardToolbar doneText={t.common.ok} />
    </SafeAreaView>
  );
}
