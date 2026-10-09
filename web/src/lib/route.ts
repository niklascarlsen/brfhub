import {useCallback, useEffect, useSyncExternalStore} from 'react';

export type MemberRoute = 'boka' | 'mina-tider' | 'lagenhet';
export type AdminRoute = 'admin/lagenheter' | 'admin/forening';
export type Route = MemberRoute | AdminRoute;

// Chrome on iOS scrolls the viewport if this is a hash URL.
const PATHS: Record<string, Route> = {
  '/boka': 'boka',
  '/mina-tider': 'mina-tider',
  '/lagenhet': 'lagenhet',
  '/admin/lagenheter': 'admin/lagenheter',
  '/admin/forening': 'admin/forening',
};

const TITLES: Record<Route, string> = {
  boka: 'Boka',
  'mina-tider': 'Mina tider',
  lagenhet: 'Lägenhet',
  'admin/lagenheter': 'Lägenheter',
  'admin/forening': 'Föreningen',
};

export function isAdminRoute(route: Route): route is AdminRoute {
  return route.startsWith('admin/');
}

export function hrefOf(route: Route): string {
  return `/${route}`;
}

// A notification opened in a new window lands on /boka?date=..&resource=..
// The slot is read once at startup and the params are removed from the
// url so a reload does not jump back to it.
export type OpenedSlot = {date: string | null; resourceId: string | null};

const DATE_PARAM = 'date';
const RESOURCE_PARAM = 'resource';

export function openedSlot(url: string): OpenedSlot {
  const {searchParams} = new URL(url, window.location.origin);

  return {
    date: searchParams.get(DATE_PARAM),
    resourceId: searchParams.get(RESOURCE_PARAM),
  };
}

function takeStartupSlot(): OpenedSlot {
  const slot = openedSlot(window.location.href);

  if (slot.date === null && slot.resourceId === null) {
    return slot;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete(DATE_PARAM);
  url.searchParams.delete(RESOURCE_PARAM);
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  );

  return slot;
}

export const startupSlot = takeStartupSlot();

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

type Navigate = (route: Route, options?: {replace?: boolean}) => void;

export function useRoute(): [Route, Navigate] {
  const route = useSyncExternalStore(subscribe, readRoute);

  // An unknown path, such as /, settles on the path of the route it falls
  // back to.
  useEffect(() => {
    document.title = TITLES[route];

    if (window.location.pathname !== hrefOf(route)) {
      window.history.replaceState(null, '', hrefOf(route));
    }
  }, [route]);

  const navigate = useCallback<Navigate>((next, options) => {
    if (readRoute() === next) {
      return;
    }

    if (options?.replace) {
      window.history.replaceState(null, '', hrefOf(next));
    } else {
      window.history.pushState(null, '', hrefOf(next));
    }
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
