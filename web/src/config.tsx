import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {api, unwrap, type BookingWindow, type Resource} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import type {MemberAccount} from '@/auth/account';
import {Blank} from '@/components/Blank';
import {Notice} from '@/components/Notice';
import {useReturnToTab} from '@/hooks/useReturnToTab';

type Config = {
  window: BookingWindow;
  resources: [Resource, ...Resource[]];
  apartment: string;
  organizationName: string;
};

const ConfigContext = createContext<Config | null>(null);

export function useConfig(): Config {
  const config = useContext(ConfigContext);

  if (config === null) {
    throw new Error('useConfig must be used inside ConfigProvider');
  }

  return config;
}

async function fetchConfig() {
  const [window, resources] = await Promise.all([
    unwrap(api.GET('/booking-window')),
    unwrap(api.GET('/resources')),
  ]);

  return {window, resources};
}

type ConfigProviderProps = {
  account: MemberAccount;
  children: ReactNode;
};

export function ConfigProvider({account, children}: ConfigProviderProps) {
  const [loaded, setLoaded] = useState<Awaited<
    ReturnType<typeof fetchConfig>
  > | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = () => setAttempt((previous) => previous + 1);

  useEffect(() => {
    let current = true;

    fetchConfig()
      .then((result) => {
        if (current) {
          setLoaded(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (current) {
          setError(codeOf(caught));
        }
      });

    return () => {
      current = false;
    };
  }, [attempt]);

  useReturnToTab(reload);

  if (loaded === null) {
    if (error !== null) {
      return (
        <Blank>
          <Notice
            message={errorMessage(error)}
            actionLabel='Försök igen'
            onAction={reload}
          />
        </Blank>
      );
    }

    return <Blank />;
  }

  const [first, ...rest] = loaded.resources;

  if (first === undefined) {
    return (
      <Blank>
        <Notice
          title='Inget att boka'
          message='Det finns inga utrymmen att boka just nu.'
          actionLabel='Försök igen'
          onAction={reload}
        />
      </Blank>
    );
  }

  return (
    <ConfigContext.Provider
      value={{
        window: loaded.window,
        resources: [first, ...rest],
        apartment: account.apartment,
        organizationName: account.organizationName,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
