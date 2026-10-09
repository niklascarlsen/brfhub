import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {BookingRules} from '@/components/BookingRules';
import {useConfig} from '@/config';

export function ApartmentScreen() {
  const {apartment, organizationName} = useConfig();

  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]'>
      <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Lägenhet {apartment}
        </h1>
        <p className='mt-1 mb-6 text-[13px] text-theme-muted'>
          {organizationName}
        </p>
        <Account signOutFrom={`lägenhet ${apartment}`} onSignOut={signOut} />
        <BookingRules listClassName='flex flex-col gap-2.5' />
      </div>
    </div>
  );
}
