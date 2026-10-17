import {parseAdminPath} from '@brfhub/core/admin/location';
import type {Messages} from '@brfhub/core/i18n/catalog';
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

// The tab a path is in: one of the paths above, or a step down in an admin
// tab. Null for a path that names nothing.
function routeOf(path: string): Route | null {
  const exact = PATHS[path];

  if (exact) {
    return exact;
  }

  const location = parseAdminPath(path);
  return location ? `admin/${location.tab}` : null;
}

function readPath(): string {
  return window.location.pathname;
}

function readRoute(): Route {
  return routeOf(readPath()) ?? 'book';
}

const readers = new Set<() => void>();

// The path on screen, which the browser's back and forward may be kept
// from leaving.
let shown = readPath();
let shownState: unknown = window.history.state;
let historyGuard: ((proceed: () => void) => boolean) | null = null;
// A step the page takes itself, such as up from a form it has saved, which
// the guard has nothing to ask about.
let unguarded = false;

function notify() {
  shown = readPath();
  shownState = window.history.state;

  for (const read of readers) {
    read();
  }
}

window.addEventListener('popstate', () => {
  const next = readPath();

  if (unguarded) {
    unguarded = false;
  } else if (next !== shown && historyGuard !== null) {
    let asked = false;
    const allowed = historyGuard(() => {
      // The page put back sits just past next, so one step back reaches
      // it, whether the browser went back or forward.
      if (asked) {
        unguarded = true;
        window.history.back();
      }
    });
    asked = true;

    if (!allowed) {
      // The address bar already says next. Put back the page still shown
      // until the guard says to go on.
      window.history.pushState(shownState, '', shown);
      return;
    }
  }

  notify();
});

function subscribe(onChange: () => void) {
  readers.add(onChange);

  return () => {
    readers.delete(onChange);
  };
}

// Asked before the browser's back or forward leaves the path shown: true
// lets it go, false keeps the page until the guard calls proceed.
export function useHistoryGuard(guard: (proceed: () => void) => boolean) {
  useEffect(() => {
    historyGuard = guard;

    return () => {
      if (historyGuard === guard) {
        historyGuard = null;
      }
    };
  }, [guard]);
}

// What a step down remembers of the page it came from, so going up again
// is the browser's own back. A reload keeps the history's states but
// starts a new page load, and back from there would load the app again,
// so a step only goes back within the load that took it.
type StepState = {from: string; load: string} | null;

// Not crypto.randomUUID, which plain http on a LAN address lacks.
const LOAD = `${Date.now()}-${Math.random()}`;

export type GoOptions = {replace?: boolean};

// Goes to a path. A step down remembers where it came from; one that
// replaces the page keeps what that page came from.
export function goTo(path: string, {replace = false}: GoOptions = {}) {
  if (readPath() === path) {
    return;
  }

  if (replace) {
    window.history.replaceState(window.history.state, '', path);
  } else {
    const state: StepState = {from: readPath(), load: LOAD};
    window.history.pushState(state, '', path);
  }
  window.scrollTo(0, 0);
  notify();
}

// Goes up to a page above, by the browser's back when that is where the
// page shown came from, so the history does not grow a loop.
export function goUp(path: string) {
  const state = window.history.state as StepState;

  if (state?.from === path && state.load === LOAD) {
    unguarded = true;
    window.history.back();
    return;
  }

  window.history.replaceState(null, '', path);
  notify();
}

// The path on screen, for the admin's steps within a tab.
export function usePath(): string {
  return useSyncExternalStore(subscribe, readPath);
}

type Navigate = (route: Route, options?: {replace?: boolean}) => void;

export function useRoute(): [Route, Navigate] {
  const route = useSyncExternalStore(subscribe, readRoute);
  const t = useMessages();

  // An unknown path, such as /, settles on the path of the route it falls
  // back to.
  useEffect(() => {
    document.title = TITLES[route](t);

    if (routeOf(readPath()) !== route) {
      window.history.replaceState(null, '', hrefOf(route));
    }
  }, [route, t]);

  // A tab opens at its top, also from a step down within it.
  const navigate = useCallback<Navigate>((next, options) => {
    goTo(hrefOf(next), options);
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
