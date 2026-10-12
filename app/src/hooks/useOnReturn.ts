import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';

export function useOnReturn(onReturn: () => void) {
  const handler = useRef(onReturn);

  useEffect(() => {
    handler.current = onReturn;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        handler.current();
      }
    });

    return () => subscription.remove();
  }, []);
}
