import {createContext, useContext} from 'react';

import type {AdminAccount} from '@/auth/account';

export const AdminAccountContext = createContext<AdminAccount | null>(null);

export function useAdminAccount(): AdminAccount {
  const account = useContext(AdminAccountContext);

  if (account === null) {
    throw new Error('useAdminAccount must be used inside AdminShell');
  }

  return account;
}
