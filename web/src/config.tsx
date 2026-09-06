import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {api, unwrap, type BookingWindow, type Resource} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {Notice} from '@/components/Notice';
import {useReturnToTab} from '@/hooks/useReturnToTab';

type Config = {
  window: BookingWindow;
  resources: [Resource, ...Resource[]];
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

function ConfigFallback({children}: {children: ReactNode}) {
  return <div className='flex min-h-svh flex-col bg-theme-bg'>{children}</div>;
}

export function ConfigProvider({children}: {children: ReactNode}) {
  const [loaded, setLoaded] = useState<Awaited<
    ReturnType<typeof fetchConfig>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
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
          setError(errorMessage(codeOf(caught)));
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
        <ConfigFallback>
          <Notice message={error} actionLabel='Försök igen' onAction={reload} />
        </ConfigFallback>
      );
    }

    return <ConfigFallback>{null}</ConfigFallback>;
  }

  const [first, ...rest] = loaded.resources;

  if (first === undefined) {
    return (
      <ConfigFallback>
        <Notice
          title='Inget att boka'
          message='Det finns inga utrymmen att boka just nu.'
          actionLabel='Försök igen'
          onAction={reload}
        />
      </ConfigFallback>
    );
  }

  return (
    <ConfigContext.Provider
      value={{window: loaded.window, resources: [first, ...rest]}}
    >
      {children}
    </ConfigContext.Provider>
  );
}
