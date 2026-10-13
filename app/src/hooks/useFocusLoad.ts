import {errorMessage} from '@booking/core/api/errors';
import {screenError} from '@booking/core/load/loader';
import {useLoad} from '@booking/core/load/useLoad';
import {useFocusEffect} from '@react-navigation/native';
import {useCallback} from 'react';

import {useOnReturn} from '@/hooks/useOnReturn';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

// Loads when the screen gains focus, when the app returns and when the
// identity or the language changes; the server answers in the language
// shown. The web's useFocusLoad has the same shape.
export function useFocusLoad<T>(load: () => Promise<T>, identity?: string) {
  const {locale} = useLocale();
  const t = useMessages();
  const loaded = useLoad(load, {key: identity});
  const {reload} = loaded;

  useOnReturn(reload);

  useFocusEffect(
    useCallback(() => {
      reload();
      // identity and locale are triggers, not values the callback reads.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, identity, locale]),
  );

  const error = screenError(loaded);

  return {
    data: loaded.data,
    error: error === null ? null : errorMessage(error, t),
    reload,
  };
}
