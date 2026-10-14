import {
  parentOf,
  tabRoot,
  type AdminTab,
  type LocationIn,
} from '@booking/core/admin/location';
import {useIsFocused} from '@react-navigation/native';
import {useCallback, useEffect, useState} from 'react';
import {BackHandler} from 'react-native';

import {useConfirmLeave} from '@/admin/unsaved';

// Where the admin is within a tab. The steps are not screens of their own,
// so Android's back button goes up one here instead of leaving the app;
// with unsaved changes it asks first. The web's useAdminLocation has the
// same shape, read from the address.
export function useAdminLocation<T extends AdminTab>(tab: T) {
  const [location, setLocation] = useState<LocationIn<T>>(() => tabRoot(tab));
  const confirmLeave = useConfirmLeave();
  // Every tab keeps its screen, so only the one shown answers the back
  // button.
  const focused = useIsFocused();
  const parent = parentOf(location) as LocationIn<T> | null;

  // The web replaces its history entry when asked; here every step is
  // the one state.
  const open = useCallback(
    (next: LocationIn<T>, _options?: {replace?: boolean}) => setLocation(next),
    [],
  );

  const up = useCallback(() => {
    if (parent !== null) {
      setLocation(parent);
    }
  }, [parent]);

  useEffect(() => {
    if (parent === null || !focused) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmLeave(() => setLocation(parent));
        return true;
      },
    );

    return () => subscription.remove();
  }, [parent, focused, confirmLeave]);

  return {location, open, up};
}
