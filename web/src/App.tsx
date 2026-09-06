import {useState} from 'react';

import {DialogProvider} from '@/components/Dialog';
import {TabBar} from '@/components/TabBar';
import {ConfigProvider, useConfig} from '@/config';
import {DesktopShell} from '@/desktop/DesktopShell';
import {isWithinBookingWindow} from '@/lib/dates';
import {useIsDesktop} from '@/lib/media';
import {useRoute} from '@/lib/route';
import {BookingScreen} from '@/screens/BookingScreen';
import {ReservationScreen} from '@/screens/ReservationScreen';

function Shell() {
  const {window: bookingWindow, resources} = useConfig();
  const isDesktop = useIsDesktop();
  const [route, navigate] = useRoute();
  const [chosen, setChosen] = useState(bookingWindow.today);
  const [resourceId, setResourceId] = useState(resources[0].id);

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
    <div className='flex h-dvh flex-col overflow-hidden bg-theme-bg'>
      <main
        key={route}
        className='flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain'
      >
        {route === 'boka' ? (
          <BookingScreen {...booking} />
        ) : (
          <ReservationScreen />
        )}
      </main>
      <TabBar route={route} onNavigate={navigate} />
    </div>
  );
}

export function App() {
  return (
    <DialogProvider>
      <ConfigProvider>
        <Shell />
      </ConfigProvider>
    </DialogProvider>
  );
}
