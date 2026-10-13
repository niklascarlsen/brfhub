import Ionicons from '@expo/vector-icons/Ionicons';
import type {ReactNode} from 'react';
import {Pressable, Text, View} from 'react-native';

import {authClient} from '@/auth/client';
import {useDialog} from '@/components/Dialog';
import {LanguagePicker} from '@/components/LanguagePicker';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

type AccountProps = {
  // Completes the sign-out question, such as "lägenhet 12".
  signOutFrom: string;
  onSignOut: () => Promise<void>;
  // The account's other app, for one that both books and manages.
  switchTo: {label: string; onPress: () => void} | null;
  // Shown under the card, such as the apartment's push switch.
  children?: ReactNode;
};

export function Account({
  signOutFrom,
  onSignOut,
  switchTo,
  children,
}: AccountProps) {
  const {data: session} = authClient.useSession();
  const dialog = useDialog();
  const t = useMessages();

  const confirmSignOut = () =>
    dialog.confirm(t.account.signOut, t.account.signOutQuestion(signOutFrom), {
      label: t.account.signOut,
      onPress: () => {
        void onSignOut();
      },
    });

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
        {switchTo ? (
          <Pressable
            onPress={switchTo.onPress}
            className='mt-2.5 h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-theme-line bg-theme-surface px-[18px] active:opacity-70'
          >
            <Text className='text-sm font-semibold tracking-tight text-theme-ink'>
              {switchTo.label}
            </Text>
            <Ionicons name='chevron-forward' size={16} color={theme.faint} />
          </Pressable>
        ) : null}
        {children}
      </View>
      <LanguagePicker />
    </>
  );
}
