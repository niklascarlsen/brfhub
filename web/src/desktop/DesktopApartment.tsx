import {Account} from '@/components/Account';
import {BookingRules} from '@/components/BookingRules';
import {ChevronBackIcon} from '@/components/icons';
import {useConfig} from '@/config';
import {SHELL} from '@/desktop/layout';
import {PageHeader} from '@/desktop/PageHeader';
import {linkProps, type Route} from '@/lib/route';

export function DesktopApartment({
  onNavigate,
}: {
  onNavigate: (route: Route) => void;
}) {
  const {apartment, organizationName} = useConfig();

  return (
    <>
      <PageHeader eyebrow={organizationName} title={`Lägenhet ${apartment}`}>
        <a
          {...linkProps('boka', onNavigate)}
          className='flex h-11 items-center gap-2 rounded-full bg-theme-ink pr-5 pl-4 text-sm font-semibold text-theme-surface transition-opacity hover:opacity-90'
        >
          <ChevronBackIcon size={16} />
          Till bokningen
        </a>
      </PageHeader>
      {/* Account keeps its own bottom margin from the mobile screen. */}
      <div className={`${SHELL} flex flex-col pt-7 pb-12`}>
        <div className='max-w-xl'>
          <Account />
        </div>
        <BookingRules listClassName='grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3' />
      </div>
    </>
  );
}
