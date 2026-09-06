import {useCallback, useEffect, useSyncExternalStore} from 'react';

export type Route = 'boka' | 'mina-tider';

// Chrome on iOS scrolls the viewport if this is a hash URL.
const PATHS: Record<string, Route> = {
  '/boka': 'boka',
  '/mina-tider': 'mina-tider',
};

const TITLES: Record<Route, string> = {
  boka: 'Boka',
  'mina-tider': 'Mina tider',
};

export function hrefOf(route: Route): string {
  return `/${route}`;
}

function readRoute(): Route {
  return PATHS[window.location.pathname] ?? 'boka';
}

const readers = new Set<() => void>();

function subscribe(onChange: () => void) {
  readers.add(onChange);
  window.addEventListener('popstate', onChange);

  return () => {
    readers.delete(onChange);
    window.removeEventListener('popstate', onChange);
  };
}

export function useRoute(): [Route, (route: Route) => void] {
  const route = useSyncExternalStore(subscribe, readRoute);

  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  const navigate = useCallback((next: Route) => {
    if (readRoute() === next) {
      return;
    }

    window.history.pushState(null, '', hrefOf(next));
    window.scrollTo(0, 0);

    for (const read of readers) {
      read();
    }
  }, []);

  return [route, navigate];
}

export function linkProps(route: Route, navigate: (route: Route) => void) {
  return {
    href: hrefOf(route),
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      navigate(route);
    },
  };
}
