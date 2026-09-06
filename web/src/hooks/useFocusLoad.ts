import {useEffect, useRef, useState} from 'react';

import {codeOf, errorMessage} from '@/api/errors';
import {useResetWhenChanged} from '@/hooks/useResetWhenChanged';
import {useReturnToTab} from '@/hooks/useReturnToTab';

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

  useReturnToTab(reload);

  useResetWhenChanged(`${scope}:${attempt}`, () => setError(null));

  useEffect(() => {
    let current = true;

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
  }, [scope, attempt]);

  return {
    data: loaded?.key === scope ? loaded.value : null,
    error,
    reload,
  };
}
