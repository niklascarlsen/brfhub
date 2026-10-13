import {useCallback, useEffect, useRef, useState} from 'react';

import {
  createLoader,
  dataFor,
  NOTHING_LOADED,
  type LoadState,
  type Run,
} from './loader';

type LoadOptions<T> = Partial<Omit<Run<T>, 'load'>>;

// Holds what load answers. It never loads by itself: each client calls
// reload from its own triggers, such as focus, a return to the app or a
// retry. While a new identity loads, the last one's answer is not shown.
export function useLoad<T>(
  load: () => Promise<T>,
  {key = '', forgets, onSettle}: LoadOptions<T> = {},
) {
  const [state, setState] = useState<LoadState<T>>(NOTHING_LOADED);
  const [loader] = useState(() => createLoader<T>(setState));
  const latest = useRef<Run<T>>({key, load, forgets, onSettle});

  // Declared before the triggers' effects, so a reload they start reads
  // this render's load and key.
  useEffect(() => {
    latest.current = {key, load, forgets, onSettle};
  });

  // An answer after unmount, such as the account's after signing out,
  // changes nothing.
  useEffect(() => loader.listen(), [loader]);

  const reload = useCallback(() => loader.run(latest.current), [loader]);

  return {
    data: dataFor(state, key),
    error: state.error,
    loading: state.loading,
    reload,
  };
}
