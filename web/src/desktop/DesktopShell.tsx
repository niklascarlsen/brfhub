import {CalendarOutlineIcon} from '@/components/icons';
import {useConfig} from '@/config';
import {DesktopApartment} from '@/desktop/DesktopApartment';
import {DesktopBooking, type BookingProps} from '@/desktop/DesktopBooking';
import {SHELL} from '@/desktop/layout';
import {OrganizationMark} from '@/desktop/OrganizationMark';
import {useMessages} from '@/i18n/LocaleProvider';
import {linkProps, type Route} from '@/lib/route';

type DesktopShellProps = BookingProps & {
  route: Route;
  onNavigate: (route: Route) => void;
};

export function DesktopShell({
  route,
  onNavigate,
  ...booking
}: DesktopShellProps) {
  const {apartment, organizationName} = useConfig();
  const t = useMessages();

  const onApartment = route === 'apartment';

  return (
    <div className='flex min-h-dvh flex-col bg-theme-bg'>
      <header
        className={`${SHELL} flex shrink-0 flex-wrap items-center justify-between gap-3 pt-5.5`}
      >
        <a
          {...linkProps('book', onNavigate)}
          className='flex items-center gap-2.5 rounded-xl py-1 pr-2 text-theme-ink'
        >
          <OrganizationMark name={organizationName} />
        </a>
        <nav className='flex items-center gap-2' aria-label={t.tabs.mainMenu}>
          <a
            {...linkProps('book', onNavigate)}
            aria-current={onApartment ? undefined : 'page'}
            className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
              onApartment
                ? 'text-theme-muted hover:text-theme-ink'
                : 'bg-theme-ink text-theme-surface'
            }`}
          >
            <CalendarOutlineIcon size={17} className='-translate-y-px' />
            {t.tabs.book}
          </a>
          <a
            {...linkProps('apartment', onNavigate)}
            aria-current={onApartment ? 'page' : undefined}
            className={`flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1 text-sm font-semibold transition-colors ${
              onApartment
                ? 'border-theme-ink bg-theme-ink text-theme-surface'
                : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
            }`}
          >
            <span className='flex h-8 min-w-8 items-center justify-center rounded-full bg-theme-accent px-1.5 text-xs font-bold text-theme-surface tabular-nums'>
              {apartment}
            </span>
            {t.tabs.apartment}
          </a>
        </nav>
      </header>
      <main className='flex grow flex-col'>
        {onApartment ? (
          <DesktopApartment onNavigate={onNavigate} />
        ) : (
          <DesktopBooking {...booking} />
        )}
      </main>
    </div>
  );
}
