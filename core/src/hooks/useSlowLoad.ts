import {useEffect, useState} from 'react';

import {useResetWhenChanged} from './useResetWhenChanged';

const SKELETON_DELAY_MS = 200;

export function useSlowLoad(loading: boolean): boolean {
  const [waited, setWaited] = useState(false);

  useResetWhenChanged(loading, () => setWaited(false));

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = setTimeout(() => setWaited(true), SKELETON_DELAY_MS);

    return () => clearTimeout(timer);
  }, [loading]);

  return loading && waited;
}
