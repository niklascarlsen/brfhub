import {AdminAccountContext} from '@booking/core/admin/account';
import type {AdminAccount} from '@booking/core/auth/account';
import {useEffect} from 'react';

import {AdminAnnouncements} from '@/admin/AdminAnnouncements';
import {AdminApartments} from '@/admin/AdminApartments';
import {AdminOrganization} from '@/admin/AdminOrganization';
import {AdminResources} from '@/admin/AdminResources';
import {UnsavedContext, useUnsavedRoot} from '@/admin/unsaved';
import {
  GridOutlineIcon,
  MegaphoneOutlineIcon,
  PeopleOutlineIcon,
  SettingsOutlineIcon,
} from '@/components/icons';
import {TabBar} from '@/components/TabBar';
import type {Tab} from '@/components/tabs';
import {SHELL} from '@/desktop/layout';
import {OrganizationMark} from '@/desktop/OrganizationMark';
import {useMessages} from '@/i18n/LocaleProvider';
import {useIsDesktop} from '@/lib/media';
import {dropPushSubscription} from '@/lib/push';
import {
  isAdminRoute,
  linkProps,
  useHistoryGuard,
  useRoute,
  type Route,
} from '@/lib/route';

const ADMIN_TABS: readonly Tab[] = [
  {
    route: 'admin/apartments',
    label: (t) => t.tabs.apartments,
    Icon: PeopleOutlineIcon,
  },
  {
    route: 'admin/resources',
    label: (t) => t.tabs.resources,
    Icon: GridOutlineIcon,
  },
  {
    route: 'admin/announcements',
    label: (t) => t.tabs.announcements,
    Icon: MegaphoneOutlineIcon,
  },
  {
    route: 'admin/organization',
    label: (t) => t.tabs.organization,
    Icon: SettingsOutlineIcon,
  },
];

// The admin's app. It books nothing, so none of the booking screens, push or
// their routes are mounted here.
type AdminShellProps = {
  account: AdminAccount;
  onRefresh: () => void;
};

export function AdminShell({account, onRefresh}: AdminShellProps) {
  const t = useMessages();
  const isDesktop = useIsDesktop();
  const [route, navigate] = useRoute();
  const unsaved = useUnsavedRoot();
  // Each tab mounts its page afresh, so a form left half done is lost.
  const leaveTo = (target: Route) =>
    unsaved.confirmLeave(() => navigate(target));
  useHistoryGuard(leaveTo);

  // A browser an apartment used before may still hand its push to the
  // apartment; an admin without one should not get those notifications.
  const booksToo = account.apartment !== null;
  useEffect(() => {
    if (booksToo) {
      return;
    }

    dropPushSubscription().catch((error: unknown) => {
      console.warn('[push] could not drop subscription', error);
    });
  }, [booksToo]);

  // A booking page left in the address bar, or a tab not built yet.
  const known = ADMIN_TABS.some((tab) => tab.route === route);
  useEffect(() => {
    if (!isAdminRoute(route) || !known) {
      navigate('admin/apartments', {replace: true});
    }
  }, [route, known, navigate]);

  const page =
    route === 'admin/organization' ? (
      <AdminOrganization />
    ) : route === 'admin/resources' ? (
      <AdminResources />
    ) : route === 'admin/announcements' ? (
      <AdminAnnouncements />
    ) : (
      <AdminApartments />
    );

  if (isDesktop) {
    return (
      <AdminAccountContext.Provider value={{account, refresh: onRefresh}}>
        <UnsavedContext.Provider value={unsaved}>
          <div className='flex min-h-dvh flex-col bg-theme-bg'>
            <header
              className={`${SHELL} flex shrink-0 flex-wrap items-center justify-between gap-3 pt-5.5`}
            >
              <a
                {...linkProps('admin/apartments', leaveTo)}
                className='flex items-center gap-2.5 rounded-xl py-1 pr-2 text-theme-ink'
              >
                <OrganizationMark name={account.organizationName} />
              </a>
              <nav
                className='flex items-center gap-2'
                aria-label={t.tabs.mainMenu}
              >
                {ADMIN_TABS.map(({route: target, label, Icon}) => {
                  const active = route === target;

                  return (
                    <a
                      key={target}
                      {...linkProps(target, leaveTo)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-theme-ink text-theme-surface'
                          : 'text-theme-muted hover:text-theme-ink'
                      }`}
                    >
                      <Icon size={17} className='-translate-y-px' />
                      {label(t)}
                    </a>
                  );
                })}
              </nav>
            </header>
            <main key={route} className='flex grow flex-col'>
              {page}
            </main>
          </div>
        </UnsavedContext.Provider>
      </AdminAccountContext.Provider>
    );
  }

  return (
    <AdminAccountContext.Provider value={{account, refresh: onRefresh}}>
      <UnsavedContext.Provider value={unsaved}>
        <div className='flex h-dvh flex-col overflow-hidden bg-theme-bg pt-[env(safe-area-inset-top)]'>
          <main
            key={route}
            className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain'
          >
            {page}
          </main>
          <TabBar tabs={ADMIN_TABS} route={route} onNavigate={leaveTo} />
        </div>
      </UnsavedContext.Provider>
    </AdminAccountContext.Provider>
  );
}
