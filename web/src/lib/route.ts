import type {Messages} from '@booking/core/i18n/catalog';
import {useCallback, useEffect, useSyncExternalStore} from 'react';

import {useMessages} from '@/i18n/LocaleProvider';

export type MemberRoute = 'book' | 'my-times' | 'apartment';
export type AdminRoute =
  | 'admin/apartments'
  | 'admin/resources'
  | 'admin/announcements'
  | 'admin/organization';
export type Route = MemberRoute | AdminRoute;

// Chrome on iOS scrolls the viewport if this is a hash URL.
const PATHS: Record<string, Route> = {
  '/book': 'book',
  '/my-times': 'my-times',
  '/apartment': 'apartment',
  '/admin/apartments': 'admin/apartments',
  '/admin/resources': 'admin/resources',
  '/admin/announcements': 'admin/announcements',
  '/admin/organization': 'admin/organization',
};

const TITLES: Record<Route, (t: Messages) => string> = {
  book: (t) => t.tabs.book,
  'my-times': (t) => t.tabs.myTimes,
  apartment: (t) => t.tabs.apartment,
  'admin/apartments': (t) => t.tabs.apartments,
  'admin/resources': (t) => t.tabs.resources,
  'admin/announcements': (t) => t.tabs.announcements,
  'admin/organization': (t) => t.tabs.organization,
};

export function isAdminRoute(route: Route): route is AdminRoute {
  return route.startsWith('admin/');
}

export function hrefOf(route: Route): string {
  return `/${route}`;
}

// A notification opened in a new window lands on /book?date=..&resource=..
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
  return PATHS[window.location.pathname] ?? 'book';
}

const readers = new Set<() => void>();

// The route on screen, which the browser's back and forward may be kept
// from leaving.
let shown = readRoute();
let historyGuard: ((route: Route) => boolean) | null = null;

function notify() {
  shown = readRoute();

  for (const read of readers) {
    read();
  }
}

window.addEventListener('popstate', () => {
  const next = readRoute();

  if (next !== shown && historyGuard !== null && !historyGuard(next)) {
    // The address bar already says next. Put back the page still shown;
    // the guard goes on to next itself if it is told to.
    window.history.pushState(null, '', hrefOf(shown));
    return;
  }

  notify();
});

function subscribe(onChange: () => void) {
  readers.add(onChange);

  return () => {
    readers.delete(onChange);
  };
}

// Asked before the browser's back or forward leaves the route shown: true
// lets it go, false keeps the page.
export function useHistoryGuard(guard: (route: Route) => boolean) {
  useEffect(() => {
    historyGuard = guard;

    return () => {
      if (historyGuard === guard) {
        historyGuard = null;
      }
    };
  }, [guard]);
}

type Navigate = (route: Route, options?: {replace?: boolean}) => void;

export function useRoute(): [Route, Navigate] {
  const route = useSyncExternalStore(subscribe, readRoute);
  const t = useMessages();

  // An unknown path, such as /, settles on the path of the route it falls
  // back to.
  useEffect(() => {
    document.title = TITLES[route](t);

    if (window.location.pathname !== hrefOf(route)) {
      window.history.replaceState(null, '', hrefOf(route));
    }
  }, [route, t]);

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
    notify();
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
