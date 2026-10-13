import {useSwitchMode} from '@booking/core/auth/mode';
import {useConfig} from '@booking/core/config/config';

import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {AnnouncementList} from '@/components/Announcements';
import {BookingRules} from '@/components/BookingRules';
import {ChevronBackIcon} from '@/components/icons';
import {SHELL} from '@/desktop/layout';
import {PageHeader} from '@/desktop/PageHeader';
import {useMessages} from '@/i18n/LocaleProvider';
import {linkProps, type Route} from '@/lib/route';

export function DesktopApartment({
  onNavigate,
}: {
  onNavigate: (route: Route) => void;
}) {
  const {apartment, organizationName, admin} = useConfig();
  const switchMode = useSwitchMode();
  const t = useMessages();

  return (
    <>
      <PageHeader
        eyebrow={organizationName}
        title={t.apartment.title(apartment)}
      >
        <a
          {...linkProps('book', onNavigate)}
          className='flex h-11 items-center gap-2 rounded-full bg-theme-ink pr-5 pl-4 text-sm font-semibold text-theme-surface transition-opacity hover:opacity-90'
        >
          <ChevronBackIcon size={16} />
          {t.apartment.backToBooking}
        </a>
      </PageHeader>
      {/* Account keeps its own bottom margin from the mobile screen. */}
      <div className={`${SHELL} flex flex-col pt-7 pb-12`}>
        <div className='max-w-xl'>
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
          />
          <AnnouncementList />
        </div>
        <BookingRules listClassName='grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3' />
      </div>
    </>
  );
}
