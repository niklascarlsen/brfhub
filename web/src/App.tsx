import {firstOpenResource} from '@brfhub/core/booking/closing';
import {useConfig} from '@brfhub/core/config/config';
import {isWithinBookingWindow} from '@brfhub/core/lib/dates';
import type {Mode} from '@brfhub/core/auth/account';
import {SwitchModeContext} from '@brfhub/core/auth/mode';
import {useCallback, useEffect, useState} from 'react';

import {AdminShell} from '@/admin/AdminShell';
import {AccountGate} from '@/auth/account';
import {SessionGate} from '@/auth/session';
import {DialogProvider} from '@/components/Dialog';
import {TabBar} from '@/components/TabBar';
import {MEMBER_TABS, TAB_BAR_CLEARANCE} from '@/components/tabs';
import {ConfigProvider} from '@/config';
import {DesktopShell} from '@/desktop/DesktopShell';
import {LocaleProvider} from '@/i18n/LocaleProvider';
import {usePushPrompt} from '@/hooks/usePushPrompt';
import {useIsDesktop} from '@/lib/media';
import {onNotificationOpen} from '@/lib/push';
import {isAdminRoute, startupSlot, useRoute} from '@/lib/route';
import {ApartmentScreen} from '@/screens/ApartmentScreen';
import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';
import {TwoFactorSetup} from '@/screens/TwoFactorSetup';

function Shell() {
  const {window: bookingWindow, resources} = useConfig();
  const isDesktop = useIsDesktop();

  usePushPrompt();
  const [route, navigate] = useRoute();
  const [chosen, setChosen] = useState(startupSlot.date ?? bookingWindow.today);
  // A closed resource is never where the page opens.
  const [resourceId, setResourceId] = useState(
    startupSlot.resourceId ?? firstOpenResource(resources).id,
  );

  // A notification tapped while the app is open jumps to the slot.
  useEffect(
    () =>
      onNotificationOpen((slot) => {
        if (slot.date !== null) {
          setChosen(slot.date);
        }

        if (slot.resourceId !== null) {
          setResourceId(slot.resourceId);
        }

        navigate('book');
      }),
    [navigate],
  );

  // Desktop lists the apartment's times on the booking page and has no
  // page of its own for them.
  useEffect(() => {
    if (isDesktop && route === 'my-times') {
      navigate('book', {replace: true});
    }
  }, [isDesktop, route, navigate]);

  // An admin page left in the address bar by someone who signed out.
  useEffect(() => {
    if (isAdminRoute(route)) {
      navigate('book', {replace: true});
    }
  }, [route, navigate]);

  const date = isWithinBookingWindow(chosen, bookingWindow)
    ? chosen
    : bookingWindow.today;
  const resource =
    resources.find((item) => item.id === resourceId) ?? resources[0];

  const booking = {
    bookingWindow,
    resources,
    resource,
    onSelectResource: setResourceId,
    date,
    onSelectDate: setChosen,
  };

  if (isDesktop) {
    return <DesktopShell {...booking} route={route} onNavigate={navigate} />;
  }

  return (
    <div
      className={`relative flex h-dvh flex-col overflow-hidden bg-theme-bg pt-[env(safe-area-inset-top)] ${TAB_BAR_CLEARANCE}`}
    >
      <main
        key={route}
        className='flex min-h-0 flex-1 flex-col overflow-hidden'
      >
        {route === 'book' ? (
          <BookingScreen {...booking} />
        ) : route === 'my-times' ? (
          <ReservationScreen />
        ) : (
          <ApartmentScreen />
        )}
      </main>
      <TabBar tabs={MEMBER_TABS} route={route} onNavigate={navigate} />
    </div>
  );
}

// On the web the mode is the route: an account that both books and
// manages is on the admin's pages or the apartment's.
function Gate() {
  const [route, navigate] = useRoute();
  const switchMode = useCallback(
    (mode: Mode) => navigate(mode === 'admin' ? 'admin/apartments' : 'book'),
    [navigate],
  );

  return (
    <SwitchModeContext.Provider value={switchMode}>
      <AccountGate
        mode={isAdminRoute(route) ? 'admin' : 'member'}
        member={(account) => (
          <ConfigProvider account={account}>
            <Shell />
          </ConfigProvider>
        )}
        admin={(account, refresh) => (
          <AdminShell account={account} onRefresh={refresh} />
        )}
        twoFactorSetup={(account, refresh) => (
          <TwoFactorSetup account={account} onDone={refresh} />
        )}
      />
    </SwitchModeContext.Provider>
  );
}

export function App() {
  return (
    <LocaleProvider>
      <DialogProvider>
        <SessionGate>
          <Gate />
        </SessionGate>
      </DialogProvider>
    </LocaleProvider>
  );
}
