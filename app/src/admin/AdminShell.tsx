import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import type {AdminAccount} from '@/auth/account';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';

async function signOutAdmin() {
  await authClient.signOut();
}

// The admin's app. It books nothing, so none of the booking screens or push
// are mounted here.
export function AdminShell({account}: {account: AdminAccount}) {
  const {organizationName} = account;

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <ScrollView
        className='flex-1'
        contentContainerClassName='grow px-5 pb-8 pt-2'
      >
        <Text className='text-[27px] font-semibold tracking-tight text-theme-ink'>
          Administration
        </Text>
        <Text className='mb-6 mt-1 font-sans text-[13px] text-theme-muted'>
          {organizationName}
        </Text>
        <Account signOutFrom={organizationName} onSignOut={signOutAdmin} />
        <Text className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
          Föreningen
        </Text>
        <View className='rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'>
          <Text className='font-sans text-[13px] leading-5 text-theme-ink'>
            Här kommer du att lägga till lägenheter och ställa in resurser,
            tider, regler och anslag.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
