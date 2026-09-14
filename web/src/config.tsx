import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {api, unwrap, type BookingWindow, type Resource} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import {signOut} from '@/auth/signOut';
import {Notice} from '@/components/Notice';
import {useReturnToTab} from '@/hooks/useReturnToTab';

type Config = {
  window: BookingWindow;
  resources: [Resource, ...Resource[]];
  apartment: string;
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
  const [window, resources, me] = await Promise.all([
    unwrap(api.GET('/booking-window')),
    unwrap(api.GET('/resources')),
    unwrap(api.GET('/me')),
  ]);

  return {window, resources, apartment: me.apartment};
}

function ConfigFallback({children}: {children: ReactNode}) {
  return <div className='flex min-h-svh flex-col bg-theme-bg'>{children}</div>;
}

export function ConfigProvider({children}: {children: ReactNode}) {
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
    // Signed in but no apartment answers for this account: it has not been
    // linked yet, or the apartment has moved out. Retrying cannot fix that.
    if (error === 'UNAUTHORIZED') {
      return (
        <ConfigFallback>
          <Notice
            title='Kontot saknar lägenhet'
            message='Ditt konto är inte kopplat till någon lägenhet. Kontakta styrelsen.'
            actionLabel='Logga ut'
            onAction={() => void signOut()}
          />
        </ConfigFallback>
      );
    }

    if (error !== null) {
      return (
        <ConfigFallback>
          <Notice
            message={errorMessage(error)}
            actionLabel='Försök igen'
            onAction={reload}
          />
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
      value={{
        window: loaded.window,
        resources: [first, ...rest],
        apartment: loaded.apartment,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}
