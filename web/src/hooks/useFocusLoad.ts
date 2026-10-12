import {
  codeOf,
  errorMessage,
  type ClientErrorCode,
} from '@booking/core/api/errors';
import {useResetWhenChanged} from '@booking/core/hooks/useResetWhenChanged';
import {useEffect, useRef, useState} from 'react';

import {useOnReturn} from '@/hooks/useOnReturn';
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

  useOnReturn(reload);

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
          setError(codeOf(caught));
        }
      });

    return () => {
      current = false;
    };
  }, [scope, attempt, locale]);

  const t = useMessages();

  return {
    data: loaded?.key === scope ? loaded.value : null,
    error: error === null ? null : errorMessage(error, t),
    reload,
  };
}
