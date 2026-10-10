import {createContext, useContext, type ReactNode} from 'react';

import {CATALOGS, type Messages} from '@/i18n/catalog';

const MessagesContext = createContext<Messages | null>(null);

export function useMessages(): Messages {
  const messages = useContext(MessagesContext);

  if (messages === null) {
    throw new Error('useMessages must be used inside LocaleProvider');
  }

  return messages;
}

export function LocaleProvider({children}: {children: ReactNode}) {
  return (
    <MessagesContext.Provider value={CATALOGS.sv}>
      {children}
    </MessagesContext.Provider>
  );
}
