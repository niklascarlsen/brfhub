import {useSyncExternalStore} from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

const desktop = window.matchMedia(DESKTOP_QUERY);

function subscribe(onChange: () => void) {
  desktop.addEventListener('change', onChange);
  return () => desktop.removeEventListener('change', onChange);
}

function isDesktop() {
  return desktop.matches;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktop);
}
