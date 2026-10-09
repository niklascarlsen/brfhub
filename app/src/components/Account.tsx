import {Alert, Pressable, Text, View} from 'react-native';

import {authClient} from '@/auth/client';

type AccountProps = {
  // Completes "Vill du logga ut från …?".
  signOutFrom: string;
  onSignOut: () => Promise<void>;
};

export function Account({signOutFrom, onSignOut}: AccountProps) {
  const {data: session} = authClient.useSession();

  const confirmSignOut = () =>
    Alert.alert('Logga ut', `Vill du logga ut från ${signOutFrom}?`, [
      {text: 'Avbryt', style: 'cancel'},
      {
        text: 'Logga ut',
        onPress: () => {
          void onSignOut();
        },
      },
    ]);

  return (
    <View className='mb-[26px]'>
      <Text className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
        Konto
      </Text>
      <View className='flex-row items-center gap-3.5 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'>
        <View className='min-w-0 flex-1 gap-1'>
          <Text className='text-sm font-semibold text-theme-muted'>
            Inloggad som
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
            Logga ut
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
