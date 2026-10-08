import {useEffect, useState} from 'react';

import {SessionGate} from '@/auth/session';
import {DialogProvider} from '@/components/Dialog';
import {TabBar} from '@/components/TabBar';
import {ConfigProvider, useConfig} from '@/config';
import {DesktopShell} from '@/desktop/DesktopShell';
import {isWithinBookingWindow} from '@/lib/dates';
import {usePushPrompt} from '@/hooks/usePushPrompt';
import {useIsDesktop} from '@/lib/media';
import {onNotificationOpen} from '@/lib/push';
import {startupSlot, useRoute} from '@/lib/route';
import {ApartmentScreen} from '@/screens/ApartmentScreen';
import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';

function Shell() {
  const {window: bookingWindow, resources} = useConfig();
  const isDesktop = useIsDesktop();

  usePushPrompt();
  const [route, navigate] = useRoute();
  const [chosen, setChosen] = useState(startupSlot.date ?? bookingWindow.today);
  const [resourceId, setResourceId] = useState(
    startupSlot.resourceId ?? resources[0].id,
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

        navigate('boka');
      }),
    [navigate],
  );

  // Desktop lists the apartment's times on the booking page and has no
  // page of its own for them.
  useEffect(() => {
    if (isDesktop && route === 'mina-tider') {
      navigate('boka', {replace: true});
    }
  }, [isDesktop, route, navigate]);

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
    <div className='flex h-dvh flex-col overflow-hidden bg-theme-bg pt-[env(safe-area-inset-top)]'>
      <main
        key={route}
        className='flex min-h-0 flex-1 flex-col overflow-hidden'
      >
        {route === 'boka' ? (
          <BookingScreen {...booking} />
        ) : route === 'mina-tider' ? (
          <ReservationScreen />
        ) : (
          <ApartmentScreen />
        )}
      </main>
      <TabBar route={route} onNavigate={navigate} />
    </div>
  );
}

export function App() {
  return (
    <DialogProvider>
      <SessionGate>
        <ConfigProvider>
          <Shell />
        </ConfigProvider>
      </SessionGate>
    </DialogProvider>
  );
}
