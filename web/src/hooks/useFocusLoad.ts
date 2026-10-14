import {errorMessage} from '@booking/core/api/errors';
import {screenError} from '@booking/core/load/loader';
import {useLoad} from '@booking/core/load/useLoad';
import {useEffect} from 'react';

import {useOnReturn} from '@/hooks/useOnReturn';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

// Loads when the screen mounts, when the page returns and when the
// identity or the language changes; the server answers in the language
// shown. A route change mounts its screen afresh, so mounting is the
// web's focus. The app's useFocusLoad has the same shape.
export function useFocusLoad<T>(load: () => Promise<T>, identity?: string) {
  const {locale} = useLocale();
  const t = useMessages();
  const loaded = useLoad(load, {key: identity});
  const {reload} = loaded;

  useOnReturn(reload);

  useEffect(reload, [reload, identity, locale]);

  const error = screenError(loaded);

  return {
    data: loaded.data,
    error: error === null ? null : errorMessage(error, t),
    // A load is out, so what data says may be about to change.
    loading: loaded.loading,
    reload,
  };
}
