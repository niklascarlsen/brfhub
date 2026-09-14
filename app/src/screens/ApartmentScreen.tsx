import {Alert, Pressable, ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {authClient} from '@/auth/client';
import {signOut} from '@/auth/signOut';
import {useConfig} from '@/config';

function confirmSignOut(apartment: string) {
  Alert.alert('Logga ut', `Vill du logga ut från lägenhet ${apartment}?`, [
    {text: 'Avbryt', style: 'cancel'},
    {
      text: 'Logga ut',
      onPress: () => {
        void signOut();
      },
    },
  ]);
}

function Account() {
  const {data: session} = authClient.useSession();
  const {apartment} = useConfig();

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
          onPress={() => confirmSignOut(apartment)}
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

export function ApartmentScreen() {
  const {apartment} = useConfig();

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <ScrollView
        className='flex-1'
        contentContainerClassName='grow px-5 pb-8 pt-2'
      >
        <Text className='mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Lägenhet {apartment}
        </Text>
        <Account />
      </ScrollView>
    </SafeAreaView>
  );
}
