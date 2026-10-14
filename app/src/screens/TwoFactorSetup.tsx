import type {AdminAccount} from '@booking/core/auth/account';
import {
  enableFailure,
  qrCodeOf,
  secretOf,
  verifyFailure,
  type SetupStep,
} from '@booking/core/auth/twoFactor';
import {useState} from 'react';
import {Pressable, Share, Text, View} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
} from 'react-native-keyboard-controller';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  CARD,
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {authClient} from '@/auth/client';
import {signOut} from '@/auth/signOut';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {DEV_PASSWORD, devCode} from '@/lib/devCodes';
import theme from '@/theme.json';

// The focused field stays this far above the keyboard: clear of the
// toolbar on it (42, which the library does not export) and a little more.
const KEYBOARD_GAP = 42 + 24;

// The QR code the authenticator app scans, drawn as a grid of cells.
function QrCode({text}: {text: string}) {
  const {size, cells} = qrCodeOf(text);
  const cell = Math.floor(220 / size);

  return (
    <View
      accessibilityLabel={text}
      className='self-center rounded-xl bg-white p-3'
    >
      {cells.map((row, y) => (
        <View key={y} className='flex-row'>
          {row.map((dark, x) => (
            <View
              key={x}
              style={{
                width: cell,
                height: cell,
                backgroundColor: dark ? theme.ink : 'white',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type TwoFactorSetupProps = {
  account: AdminAccount;
  // The server is asked again, and shows the admin's app.
  onDone: () => void;
};

// An admin signs in with a password and a code from an authenticator app,
// and may do nothing else until one is set up: the password first, then
// the app scans the code and answers with its first code, then the backup
// codes are shown once.
export function TwoFactorSetup({account, onDone}: TwoFactorSetupProps) {
  const t = useMessages();
  const {data: session} = authClient.useSession();
  const [step, setStep] = useState<SetupStep>({kind: 'password'});
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function run(action: () => Promise<void>) {
    setSubmitting(true);
    setError(null);
    await action();
    setSubmitting(false);
  }

  const begin = () =>
    run(async () => {
      // Better Auth throws rather than answers when the network fails.
      const result = await authClient.twoFactor
        .enable({password})
        .catch(() => null);

      // The plugin can also mail codes, which this server never asks for.
      if (result === null || result.error || result.data.method !== 'totp') {
        setError(enableFailure(result?.error ?? null, t));
        return;
      }

      setPassword('');
      setCode(await devCode(session?.user.email ?? '', 'totp'));
      setStep({
        kind: 'scan',
        totpUri: result.data.totpURI,
        backupCodes: result.data.backupCodes,
      });
    });

  const verify = (backupCodes: string[]) =>
    run(async () => {
      const result = await authClient.twoFactor
        .verifyTotp({code: code.trim()})
        .catch(() => null);

      if (result === null || result.error) {
        setError(verifyFailure(result?.error ?? null, t));
        return;
      }

      setStep({kind: 'backup', backupCodes});
    });

  const share = (backupCodes: string[]) => {
    void Share.share({message: backupCodes.join('\n')});
  };

  const problem = error ? (
    <Text
      accessibilityRole='alert'
      className='font-sans text-sm text-theme-ink'
    >
      {error}
    </Text>
  ) : null;

  let body;
  if (step.kind === 'password') {
    const canSubmit = password.length > 0 && !submitting;

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.title}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.twoFactor.intro}
        </Text>
        <View className='gap-4'>
          <FloatingLabelInput
            label={t.twoFactor.password}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete='current-password'
            textContentType='password'
            returnKeyType='go'
            onSubmitEditing={() => canSubmit && void begin()}
          />
          {problem}
          <View className='flex-row flex-wrap gap-2.5'>
            <Pressable
              onPress={() => void begin()}
              disabled={!canSubmit}
              className={PRIMARY_BUTTON}
            >
              <Text className={PRIMARY_LABEL}>{t.twoFactor.begin}</Text>
            </Pressable>
            <Pressable
              onPress={() => void signOut()}
              className={SECONDARY_BUTTON}
            >
              <Text className={SECONDARY_LABEL}>{t.account.signOut}</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  } else if (step.kind === 'scan') {
    const canSubmit = code.trim().length > 0 && !submitting;

    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.scanTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.twoFactor.scanIntro}
        </Text>
        <View className='gap-4'>
          <QrCode text={step.totpUri} />
          <View className={`${CARD} gap-1`}>
            <Text className='text-sm font-semibold text-theme-muted'>
              {t.twoFactor.manualKey}
            </Text>
            <Text
              selectable
              className='text-[17px] font-semibold tracking-wide text-theme-ink'
            >
              {secretOf(step.totpUri)}
            </Text>
          </View>
          <FloatingLabelInput
            label={t.twoFactor.firstCode}
            value={code}
            onChangeText={setCode}
            autoComplete='one-time-code'
            keyboardType='number-pad'
            textContentType='oneTimeCode'
            returnKeyType='go'
            onSubmitEditing={() => canSubmit && void verify(step.backupCodes)}
          />
          {problem}
          <Pressable
            onPress={() => void verify(step.backupCodes)}
            disabled={!canSubmit}
            className={`${PRIMARY_BUTTON} self-start`}
          >
            <Text className={PRIMARY_LABEL}>{t.twoFactor.verify}</Text>
          </Pressable>
        </View>
      </>
    );
  } else {
    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.backupTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.twoFactor.backupIntro}
        </Text>
        <View className='gap-4'>
          <View className={`${CARD} gap-1.5`}>
            {step.backupCodes.map((backupCode) => (
              <Text
                key={backupCode}
                selectable
                className='text-[17px] font-semibold tracking-wide text-theme-ink'
                style={{fontVariant: ['tabular-nums']}}
              >
                {backupCode}
              </Text>
            ))}
          </View>
          <View className='flex-row flex-wrap gap-2.5'>
            <Pressable
              onPress={() => share(step.backupCodes)}
              className={SECONDARY_BUTTON}
            >
              <Text className={SECONDARY_LABEL}>{t.twoFactor.shareCodes}</Text>
            </Pressable>
            <Pressable onPress={onDone} className={PRIMARY_BUTTON}>
              <Text className={PRIMARY_LABEL}>{t.twoFactor.done}</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        className='flex-1'
        contentContainerClassName='grow justify-center px-5 pb-16 pt-2'
        keyboardShouldPersistTaps='handled'
      >
        <Text className='mb-6 mt-1 font-sans text-[13px] text-theme-muted'>
          {account.organizationName}
        </Text>
        {body}
      </KeyboardAwareScrollView>
      <KeyboardToolbar doneText={t.common.ok} />
    </SafeAreaView>
  );
}
