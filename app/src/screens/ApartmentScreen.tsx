import {useSwitchMode} from '@booking/core/auth/mode';
import {useConfig} from '@booking/core/config/config';
import {ScrollView, Text} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {AnnouncementList} from '@/components/Announcements';
import {BookingRules} from '@/components/BookingRules';
import {useMessages} from '@/i18n/LocaleProvider';

export function ApartmentScreen() {
  const {apartment, organizationName, admin} = useConfig();
  const switchMode = useSwitchMode();
  const t = useMessages();

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <ScrollView
        className='flex-1'
        contentContainerClassName='grow px-5 pb-8 pt-2'
      >
        <Text className='text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.apartment.title(apartment)}
        </Text>
        <Text className='mb-6 mt-1 font-sans text-[13px] text-theme-muted'>
          {organizationName}
        </Text>
        <Account
          signOutFrom={t.apartment.signOutFrom(apartment)}
          onSignOut={signOut}
          switchTo={
            admin
              ? {label: t.account.openAdmin, onPress: () => switchMode('admin')}
              : null
          }
        />
        <AnnouncementList />
        <BookingRules />
      </ScrollView>
    </SafeAreaView>
  );
}
