import {createContext, useContext} from 'react';

import type {AdminAccount} from '../auth/account';

type AdminAccountValue = {
  account: AdminAccount;
  // Asks the server again, after the admin renamed the organization.
  refresh: () => void;
};

export const AdminAccountContext = createContext<AdminAccountValue | null>(
  null,
);

function useValue(): AdminAccountValue {
  const value = useContext(AdminAccountContext);

  if (value === null) {
    throw new Error('Admin screens must be used inside AdminShell');
  }

  return value;
}

export function useAdminAccount(): AdminAccount {
  return useValue().account;
}

export function useRefreshAccount(): () => void {
  return useValue().refresh;
}
