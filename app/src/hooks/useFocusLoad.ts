import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {codeOf, errorMessage} from '@/api/errors';

export function useFocusLoad<T>(load: () => Promise<T>, identity?: string) {
  const [loaded, setLoaded] = useState<{key: string; value: T} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = () => setAttempt((previous) => previous + 1);

  const scope = identity ?? '';
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setAttempt((previous) => previous + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      let current = true;

      setError(null);

      loadRef
        .current()
        .then((value) => {
          if (current) {
            setLoaded({key: scope, value});
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
      // attempt is a trigger, not a value the load reads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, attempt]),
  );

  return {
    data: loaded?.key === scope ? loaded.value : null,
    error,
    reload,
  };
}
