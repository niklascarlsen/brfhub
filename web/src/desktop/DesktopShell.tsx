import {CURRENT_APARTMENT_NUMBER} from '@/api/client';
import {CalendarOutlineIcon, TimeOutlineIcon} from '@/components/icons';
import {MyTimes} from '@/components/MyTimes';
import {DesktopBooking, type BookingProps} from '@/desktop/DesktopBooking';
import {SHELL} from '@/desktop/layout';
import {linkProps, type Route} from '@/lib/route';

type DesktopShellProps = BookingProps & {
  route: Route;
  onNavigate: (route: Route) => void;
};

const TABS = [
  {
    route: 'boka',
    label: 'Boka',
    Icon: CalendarOutlineIcon,
    iconClass: '-translate-y-0.25',
  },
  {
    route: 'mina-tider',
    label: 'Mina tider',
    Icon: TimeOutlineIcon,
    iconClass: '',
  },
] as const;

export function DesktopShell({
  route,
  onNavigate,
  ...booking
}: DesktopShellProps) {
  return (
    <div className='flex min-h-dvh flex-col bg-theme-bg'>
      <header className='shrink-0 border-b border-theme-line bg-theme-surface'>
        <div className={`${SHELL} flex h-16 items-center justify-between`}>
          <nav className='flex gap-1' aria-label='Huvudmeny'>
            {TABS.map(({route: target, label, Icon, iconClass}) => {
              const active = route === target;

              return (
                <a
                  key={target}
                  {...linkProps(target, onNavigate)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-9 items-center gap-2 rounded-[10px] px-3 text-[15px] leading-none transition-colors ${
                    active
                      ? 'bg-theme-sunk font-semibold text-theme-ink'
                      : 'font-medium text-theme-muted hover:text-theme-ink'
                  }`}
                >
                  <Icon size={20} className={iconClass} />
                  {label}
                </a>
              );
            })}
          </nav>
          <span className='rounded-full bg-theme-sunk px-3 py-1.5 text-[13px] font-semibold text-theme-muted'>
            Lägenhet {CURRENT_APARTMENT_NUMBER}
          </span>
        </div>
      </header>
      <main className='flex grow flex-col'>
        {route === 'boka' ? (
          <DesktopBooking {...booking} />
        ) : (
          <div className={`${SHELL} flex grow flex-col pb-12 pt-8`}>
            <h1 className='mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
              Mina tider
            </h1>
            <MyTimes layout='row' />
          </div>
        )}
      </main>
    </div>
  );
}
