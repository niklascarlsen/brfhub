import {Alert, Pressable, Text, View} from 'react-native';

import {authClient} from '@/auth/client';
import {LanguagePicker} from '@/components/LanguagePicker';
import {useMessages} from '@/i18n/LocaleProvider';

type AccountProps = {
  // Completes the sign-out question, such as "lägenhet 12".
  signOutFrom: string;
  onSignOut: () => Promise<void>;
};

export function Account({signOutFrom, onSignOut}: AccountProps) {
  const {data: session} = authClient.useSession();
  const t = useMessages();

  const confirmSignOut = () =>
    Alert.alert(t.account.signOut, t.account.signOutQuestion(signOutFrom), [
      {text: t.common.cancel, style: 'cancel'},
      {
        text: t.account.signOut,
        onPress: () => {
          void onSignOut();
        },
      },
    ]);

  return (
    <>
      <View className='mb-[26px]'>
        <Text className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
          {t.account.heading}
        </Text>
        <View className='flex-row items-center gap-3.5 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'>
          <View className='min-w-0 flex-1 gap-1'>
            <Text className='text-sm font-semibold text-theme-muted'>
              {t.account.signedInAs}
            </Text>
            <Text
              numberOfLines={1}
              className='text-[17px] font-semibold tracking-tight text-theme-ink'
            >
              {session?.user.email}
            </Text>
          </View>
          <Pressable
            onPress={confirmSignOut}
            className='h-11 items-center justify-center rounded-full border border-theme-edge bg-theme-surface px-5 active:opacity-70'
          >
            <Text className='text-sm font-semibold tracking-tight text-theme-ink'>
              {t.account.signOut}
            </Text>
          </Pressable>
        </View>
      </View>
      <LanguagePicker />
    </>
  );
}
