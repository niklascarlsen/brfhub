import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {AppState, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap, type BookingWindow, type Resource} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import type {MemberAccount} from '@/auth/account';
import {Notice} from '@/components/Notice';

// Refetched whenever the app returns: the window's dates move at midnight, and
// the device clock cannot tell what the server's day is.
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setAttempt((previous) => previous + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  if (loaded === null) {
    if (error !== null) {
      return (
        <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
          <Notice
            message={errorMessage(error)}
            actionLabel='Försök igen'
            onAction={reload}
          />
        </SafeAreaView>
      );
    }

    return <View className='flex-1 bg-theme-bg' />;
  }

  const [first, ...rest] = loaded.resources;

  if (first === undefined) {
    return (
      <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
        <Notice
          title='Inget att boka'
          message='Det finns inga utrymmen att boka just nu.'
          actionLabel='Försök igen'
          onAction={reload}
        />
      </SafeAreaView>
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
