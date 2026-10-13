import {createContext, useContext} from 'react';

import type {Mode} from './account';

// Switches an account that both books and manages to its other app. Each
// client provides it: the app keeps the mode as state, the web reads it
// from the route.
export const SwitchModeContext = createContext<((mode: Mode) => void) | null>(
  null,
);

export function useSwitchMode(): (mode: Mode) => void {
  const switchMode = useContext(SwitchModeContext);

  if (switchMode === null) {
    throw new Error('useSwitchMode must be used inside SwitchModeContext');
  }

  return switchMode;
}
