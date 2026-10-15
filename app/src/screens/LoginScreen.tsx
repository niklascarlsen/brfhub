import {useSignIn} from '@booking/core/auth/useSignIn';
import {Icon} from '@/components/Icon';
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

// Signing in is two steps: the address, then the code it is mailed or, for
// an admin, the password. On success useSession updates and the gate
// unmounts this screen.
export function LoginScreen() {
  const t = useMessages();
  const signIn = useSignIn({
    api,
    unwrap,
    auth: authClient,
    t,
    devCode,
    prefill: {email: DEV_EMAIL, password: DEV_PASSWORD},
  });
  const {step, fields, error, notice, submitting, canSubmit} = signIn;
  const submit = () => void signIn.submit();

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
          value={fields.email}
          onChangeText={(email) => signIn.edit({email})}
          autoCapitalize='none'
          autoComplete='email'
          autoCorrect={false}
          keyboardType='email-address'
          textContentType='emailAddress'
          returnKeyType='go'
          onSubmitEditing={submit}
        />
        {problem}
        <Pressable onPress={submit} disabled={!canSubmit} className={BUTTON}>
          <Text className={BUTTON_LABEL}>{t.login.continue}</Text>
        </Pressable>
      </>
    );
  } else if (step.kind === 'code') {
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
          value={fields.code}
          onChangeText={(code) => signIn.edit({code})}
          autoFocus
          autoComplete='one-time-code'
          keyboardType='number-pad'
          textContentType='oneTimeCode'
          returnKeyType='go'
          onSubmitEditing={submit}
        />
        {problem}
        <Pressable onPress={submit} disabled={!canSubmit} className={BUTTON}>
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row gap-6'>
          <Pressable
            onPress={() => void signIn.resendCode()}
            disabled={submitting}
            className={LINK}
          >
            <Text className={LINK_LABEL}>{t.login.sendNewCode}</Text>
          </Pressable>
          <Pressable onPress={signIn.backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.changeEmail}</Text>
          </Pressable>
        </View>
      </>
    );
  } else if (step.kind === 'password') {
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
          value={fields.password}
          onChangeText={(password) => signIn.edit({password})}
          autoFocus
          secureTextEntry
          autoComplete='current-password'
          textContentType='password'
          returnKeyType='go'
          onSubmitEditing={submit}
        />
        {problem}
        <Pressable onPress={submit} disabled={!canSubmit} className={BUTTON}>
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row flex-wrap gap-x-6'>
          <Pressable
            onPress={() => void signIn.startReset()}
            disabled={submitting}
            className={LINK}
          >
            <Text className={LINK_LABEL}>{t.login.setPassword}</Text>
          </Pressable>
          <Pressable onPress={signIn.backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.changeEmail}</Text>
          </Pressable>
        </View>
      </>
    );
  } else if (step.kind === 'totp') {
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
          value={fields.code}
          onChangeText={(code) => signIn.edit({code})}
          autoFocus
          autoCapitalize='none'
          autoComplete={backup ? 'off' : 'one-time-code'}
          autoCorrect={false}
          keyboardType={backup ? 'default' : 'number-pad'}
          textContentType={backup ? 'none' : 'oneTimeCode'}
          returnKeyType='go'
          onSubmitEditing={submit}
        />
        <Pressable
          onPress={() => signIn.edit({trustDevice: !fields.trustDevice})}
          accessibilityRole='checkbox'
          accessibilityState={{checked: fields.trustDevice}}
          className='mb-5 flex-row items-center gap-2.5 self-start py-1'
        >
          <Icon
            name={fields.trustDevice ? 'checkbox' : 'square-outline'}
            size={22}
            color={fields.trustDevice ? theme.ink : theme.muted}
          />
          <Text className='font-sans text-sm text-theme-ink'>
            {t.login.trustDevice}
          </Text>
        </Pressable>
        {problem}
        <Pressable onPress={submit} disabled={!canSubmit} className={BUTTON}>
          <Text className={BUTTON_LABEL}>{t.login.submit}</Text>
        </Pressable>
        <View className='mt-3 flex-row flex-wrap gap-x-6'>
          <Pressable onPress={signIn.toggleBackup} className={LINK}>
            <Text className={LINK_LABEL}>
              {backup ? t.login.useTotp : t.login.useBackupCode}
            </Text>
          </Pressable>
          <Pressable onPress={signIn.backToEmail} className={LINK}>
            <Text className={LINK_LABEL}>{t.login.startOver}</Text>
          </Pressable>
        </View>
      </>
    );
  } else {
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
            value={fields.reset.code}
            onChangeText={(value) => signIn.editReset('code', value)}
            onBlur={() => signIn.leaveReset('code')}
            problem={signIn.resetProblem('code')}
            autoFocus
            autoComplete='one-time-code'
            keyboardType='number-pad'
            textContentType='oneTimeCode'
            returnKeyType='next'
          />
          <FloatingLabelInput
            label={t.login.newPassword}
            value={fields.reset.next}
            onChangeText={(value) => signIn.editReset('next', value)}
            onBlur={() => signIn.leaveReset('next')}
            problem={signIn.resetProblem('next')}
            secureTextEntry
            autoComplete='new-password'
            textContentType='newPassword'
            returnKeyType='next'
          />
          <FloatingLabelInput
            label={t.login.repeatPassword}
            value={fields.reset.repeat}
            onChangeText={(value) => signIn.editReset('repeat', value)}
            onBlur={() => signIn.leaveReset('repeat')}
            problem={signIn.resetProblem('repeat')}
            secureTextEntry
            autoComplete='new-password'
            textContentType='newPassword'
            returnKeyType='go'
            onSubmitEditing={submit}
          />
        </View>
        {problem}
        <Pressable onPress={submit} disabled={!canSubmit} className={BUTTON}>
          <Text className={BUTTON_LABEL}>{t.login.resetSubmit}</Text>
        </Pressable>
        <View className='mt-3 flex-row flex-wrap gap-x-6'>
          <Pressable
            onPress={() => void signIn.startReset()}
            disabled={submitting}
            className={LINK}
          >
            <Text className={LINK_LABEL}>{t.login.sendNewCode}</Text>
          </Pressable>
          <Pressable onPress={signIn.backToEmail} className={LINK}>
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
