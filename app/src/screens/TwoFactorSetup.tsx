import type {AdminAccount} from '@brfhub/core/auth/account';
import {qrCodeOf, secretOf} from '@brfhub/core/auth/twoFactor';
import {useTwoFactorSetup} from '@brfhub/core/auth/useTwoFactorSetup';
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
import {theme} from '@/theme';

// The focused field stays this far above the keyboard: clear of the
// toolbar on it (42, which the library does not export) and a little more.
const KEYBOARD_GAP = 42 + 24;

// The QR code the authenticator app scans, drawn as a grid of cells.
function QrCode({text, label}: {text: string; label: string}) {
  const {size, cells} = qrCodeOf(text);
  const cell = Math.floor(220 / size);

  return (
    <View
      accessible
      accessibilityRole='image'
      accessibilityLabel={label}
      className='self-center rounded-xl bg-theme-surface p-3'
    >
      {cells.map((row, y) => (
        <View key={y} className='flex-row'>
          {row.map((dark, x) => (
            <View
              key={x}
              style={{
                width: cell,
                height: cell,
                backgroundColor: dark ? theme.ink : theme.surface,
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
  const setup = useTwoFactorSetup({
    auth: authClient,
    t,
    devCode,
    email: session?.user.email ?? '',
    onDone,
    prefill: {password: DEV_PASSWORD},
  });
  const {step, password, code, error, canSubmit} = setup;
  const submit = () => void setup.submit();

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
            onChangeText={(value) => setup.edit({password: value})}
            secureTextEntry
            autoComplete='current-password'
            textContentType='password'
            returnKeyType='go'
            onSubmitEditing={submit}
          />
          {problem}
          <View className='flex-row flex-wrap gap-2.5'>
            <Pressable
              onPress={submit}
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
    body = (
      <>
        <Text className='mb-1 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.twoFactor.scanTitle}
        </Text>
        <Text className='mb-6 font-sans text-sm leading-5 text-theme-muted'>
          {t.twoFactor.scanIntro}
        </Text>
        <View className='gap-4'>
          <QrCode text={step.totpUri} label={t.twoFactor.qrCode} />
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
            onChangeText={(value) => setup.edit({code: value})}
            autoComplete='one-time-code'
            keyboardType='number-pad'
            textContentType='oneTimeCode'
            returnKeyType='go'
            onSubmitEditing={submit}
          />
          {problem}
          <Pressable
            onPress={submit}
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
            <Pressable onPress={submit} className={PRIMARY_BUTTON}>
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
      <KeyboardToolbar>
        <KeyboardToolbar.Prev />
        <KeyboardToolbar.Next />
        <KeyboardToolbar.Done text={t.common.ok} />
      </KeyboardToolbar>
    </SafeAreaView>
  );
}
