import {useSwitchMode} from '@booking/core/auth/mode';
import {useConfig} from '@booking/core/config/config';

import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {AnnouncementList} from '@/components/Announcements';
import {BookingRules} from '@/components/BookingRules';
import {PushToggle} from '@/components/PushToggle';
import {useMessages} from '@/i18n/LocaleProvider';

export function ApartmentScreen() {
  const {apartment, organizationName, admin} = useConfig();
  const switchMode = useSwitchMode();
  const t = useMessages();

  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]'>
      <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.apartment.title(apartment)}
        </h1>
        <p className='mt-1 mb-6 text-[13px] text-theme-muted'>
          {organizationName}
        </p>
        <Account
          signOutFrom={t.apartment.signOutFrom(apartment)}
          onSignOut={signOut}
          switchTo={
            admin
              ? {
                  label: t.account.openAdmin,
                  route: 'admin/apartments',
                  onPress: () => switchMode('admin'),
                }
              : null
          }
        >
          <PushToggle />
        </Account>
        <AnnouncementList />
        <BookingRules listClassName='flex flex-col gap-2.5' />
      </div>
    </div>
  );
}
