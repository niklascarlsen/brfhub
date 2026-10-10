import {NavigationContainer} from '@react-navigation/native';
import {useEffect} from 'react';

import {AdminAccountContext} from '@/admin/account';
import {UnsavedContext, useUnsavedRoot} from '@/admin/unsaved';
import type {AdminAccount} from '@/auth/account';
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
  // apartment; the admin should not get those notifications.
  useEffect(() => {
    dropPushToken().catch((error: unknown) => {
      console.warn('[push] could not drop push token', error);
    });
  }, []);

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
