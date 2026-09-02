import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useEffect, useRef, useState} from 'react';

import {codeOf, errorMessage} from '@/api/errors';

export function useFocusLoad<T>(load: () => Promise<T>, identity?: string) {
  const [loaded, setLoaded] = useState<{key: string; value: T} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = () => setAttempt((previous) => previous + 1);

  const dropWhenStale = identity !== undefined;
  const requestKey = dropWhenStale ? `${identity}#${attempt}` : String(attempt);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useFocusEffect(
    useCallback(() => {
      let current = true;

      setError(null);

      loadRef
        .current()
        .then((value) => {
          if (current) {
            setLoaded({key: requestKey, value});
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
    }, [requestKey]),
  );

  return {
    data: dropWhenStale
      ? loaded?.key === requestKey
        ? loaded.value
        : null
      : (loaded?.value ?? null),
    error,
    reload,
  };
}
