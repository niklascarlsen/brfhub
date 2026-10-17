import {
  adminPath,
  parentOf,
  parseAdminPath,
  tabRoot,
  type AdminTab,
  type LocationIn,
} from '@brfhub/core/admin/location';
import {useCallback} from 'react';

import {goTo, goUp, usePath, type GoOptions} from '@/lib/route';

// Where the admin is within a tab, read from the address. A step down is a
// page of its own in the browser's history; going up is its back. The
// app's useAdminLocation has the same shape.
export function useAdminLocation<T extends AdminTab>(tab: T) {
  const path = usePath();
  const parsed = parseAdminPath(path);
  const location =
    parsed?.tab === tab ? (parsed as LocationIn<T>) : tabRoot(tab);

  const open = useCallback(
    (next: LocationIn<T>, options?: GoOptions) =>
      goTo(adminPath(next), options),
    [],
  );

  const parent = parentOf(location);
  const parentPath = parent ? adminPath(parent) : null;
  const up = useCallback(() => {
    if (parentPath !== null) {
      goUp(parentPath);
    }
  }, [parentPath]);

  return {location, open, up};
}
