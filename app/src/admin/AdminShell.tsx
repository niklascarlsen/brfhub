import {AdminAccountContext} from '@booking/core/admin/account';
import type {AdminAccount} from '@booking/core/auth/account';
import {NavigationContainer} from '@react-navigation/native';
import {useEffect} from 'react';

import {UnsavedContext, useUnsavedRoot} from '@/admin/unsaved';
import AdminTabNavigator from '@/navigation/AdminTabNavigator';
import {dropPushToken} from '@/push';

// The admin's app. It books nothing, so none of the booking screens or push
// are mounted here.
type AdminShellProps = {
  account: AdminAccount;
  onRefresh: () => void;
};

export function AdminShell({account, onRefresh}: AdminShellProps) {
  const unsaved = useUnsavedRoot();

  // A phone an apartment used before may still hand its push to the
  // apartment; an admin without one should not get those notifications.
  const booksToo = account.apartment !== null;
  useEffect(() => {
    if (booksToo) {
      return;
    }

    dropPushToken().catch((error: unknown) => {
      console.warn('[push] could not drop push token', error);
    });
  }, [booksToo]);

  return (
    <AdminAccountContext.Provider value={{account, refresh: onRefresh}}>
      <UnsavedContext.Provider value={unsaved}>
        <NavigationContainer>
          <AdminTabNavigator />
        </NavigationContainer>
      </UnsavedContext.Provider>
    </AdminAccountContext.Provider>
  );
}
