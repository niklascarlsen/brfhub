import {useEffect} from 'react';

import {AdminAccountContext} from '@/admin/account';
import {AdminApartments} from '@/admin/AdminApartments';
import {AdminOrganization} from '@/admin/AdminOrganization';
import type {AdminAccount} from '@/auth/account';
import {PeopleOutlineIcon, SettingsOutlineIcon} from '@/components/icons';
import {TabBar} from '@/components/TabBar';
import type {Tab} from '@/components/tabs';
import {SHELL} from '@/desktop/layout';
import {OrganizationMark} from '@/desktop/OrganizationMark';
import {useIsDesktop} from '@/lib/media';
import {dropPushSubscription} from '@/lib/push';
import {isAdminRoute, linkProps, useRoute} from '@/lib/route';

const ADMIN_TABS: readonly Tab[] = [
  {route: 'admin/lagenheter', label: 'Lägenheter', Icon: PeopleOutlineIcon},
  {route: 'admin/forening', label: 'Föreningen', Icon: SettingsOutlineIcon},
];

// The admin's app. It books nothing, so none of the booking screens, push or
// their routes are mounted here.
export function AdminShell({account}: {account: AdminAccount}) {
  const isDesktop = useIsDesktop();
  const [route, navigate] = useRoute();

  // A browser an apartment used before may still hand its push to the
  // apartment; the admin should not get those notifications.
  useEffect(() => {
    dropPushSubscription().catch((error: unknown) => {
      console.warn('[push] could not drop subscription', error);
    });
  }, []);

  // A booking page left in the address bar, or a tab not built yet.
  const known = ADMIN_TABS.some((tab) => tab.route === route);
  useEffect(() => {
    if (!isAdminRoute(route) || !known) {
      navigate('admin/lagenheter', {replace: true});
    }
  }, [route, known, navigate]);

  const page =
    route === 'admin/forening' ? <AdminOrganization /> : <AdminApartments />;

  if (isDesktop) {
    return (
      <AdminAccountContext.Provider value={account}>
        <div className='flex min-h-dvh flex-col bg-theme-bg'>
          <header
            className={`${SHELL} flex shrink-0 flex-wrap items-center justify-between gap-3 pt-5.5`}
          >
            <a
              {...linkProps('admin/lagenheter', navigate)}
              className='flex items-center gap-2.5 rounded-xl py-1 pr-2 text-theme-ink'
            >
              <OrganizationMark name={account.organizationName} />
            </a>
            <nav className='flex items-center gap-2' aria-label='Huvudmeny'>
              {ADMIN_TABS.map(({route: target, label, Icon}) => {
                const active = route === target;

                return (
                  <a
                    key={target}
                    {...linkProps(target, navigate)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-theme-ink text-theme-surface'
                        : 'text-theme-muted hover:text-theme-ink'
                    }`}
                  >
                    <Icon size={17} className='-translate-y-px' />
                    {label}
                  </a>
                );
              })}
            </nav>
          </header>
          <main key={route} className='flex grow flex-col'>
            {page}
          </main>
        </div>
      </AdminAccountContext.Provider>
    );
  }

  return (
    <AdminAccountContext.Provider value={account}>
      <div className='flex h-dvh flex-col overflow-hidden bg-theme-bg pt-[env(safe-area-inset-top)]'>
        <main
          key={route}
          className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain'
        >
          {page}
        </main>
        <TabBar tabs={ADMIN_TABS} route={route} onNavigate={navigate} />
      </div>
    </AdminAccountContext.Provider>
  );
}
