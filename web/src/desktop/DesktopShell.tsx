import {signOut} from '@/auth/signOut';
import {Account} from '@/components/Account';
import {useDialog} from '@/components/Dialog';
import {CalendarOutlineIcon, TimeOutlineIcon} from '@/components/icons';
import {MyTimes} from '@/components/MyTimes';
import {useConfig} from '@/config';
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
  const {apartment} = useConfig();
  const dialog = useDialog();

  const confirmSignOut = () =>
    dialog.confirm('Logga ut', `Vill du logga ut från lägenhet ${apartment}?`, {
      label: 'Logga ut',
      onPress: () => {
        void signOut();
      },
    });

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
          <div className='flex items-center gap-3'>
            <span className='rounded-full bg-theme-sunk px-3 py-1.5 text-[13px] font-semibold text-theme-muted'>
              Lägenhet {apartment}
            </span>
            <button
              type='button'
              onClick={confirmSignOut}
              className='h-9 rounded-[10px] px-3 text-[15px] font-medium text-theme-muted transition-colors hover:text-theme-ink'
            >
              Logga ut
            </button>
          </div>
        </div>
      </header>
      <main className='flex grow flex-col'>
        {route === 'boka' ? (
          <DesktopBooking {...booking} />
        ) : route === 'mina-tider' ? (
          <div className={`${SHELL} flex grow flex-col pb-12 pt-8`}>
            <h1 className='mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
              Mina tider
            </h1>
            <MyTimes layout='row' />
          </div>
        ) : (
          <div className={`${SHELL} flex grow flex-col pb-12 pt-8`}>
            <h1 className='mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
              Lägenhet {apartment}
            </h1>
            <Account />
          </div>
        )}
      </main>
    </div>
  );
}
