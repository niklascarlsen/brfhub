import {ScrollView, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {BookingRules} from '@/components/BookingRules';
import {useConfig} from '@/config';

export function ApartmentScreen() {
  const {apartment, organizationName} = useConfig();

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <ScrollView
        className='flex-1'
        contentContainerClassName='grow px-5 pb-8 pt-2'
      >
        <Text className='text-[27px] font-semibold tracking-tight text-theme-ink'>
          Lägenhet {apartment}
        </Text>
        <Text className='mb-6 mt-1 font-sans text-[13px] text-theme-muted'>
          {organizationName}
        </Text>
        <Account signOutFrom={`lägenhet ${apartment}`} onSignOut={signOut} />
        <BookingRules />
      </ScrollView>
    </SafeAreaView>
  );
}
