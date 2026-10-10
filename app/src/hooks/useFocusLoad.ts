import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

export function useFocusLoad<T>(load: () => Promise<T>, identity?: string) {
  // The server answers in the language shown, so a new one loads again.
  // What is shown stays until the answer comes.
  const {locale} = useLocale();
  const [loaded, setLoaded] = useState<{key: string; value: T} | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
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
            setError(codeOf(caught));
          }
        });

      return () => {
        current = false;
      };
      // attempt and locale are triggers, not values the load reads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope, attempt, locale]),
  );

  const t = useMessages();

  return {
    data: loaded?.key === scope ? loaded.value : null,
    error: error === null ? null : errorMessage(error, t),
    reload,
  };
}
