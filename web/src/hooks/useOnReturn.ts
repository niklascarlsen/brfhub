import {useEffect, useRef} from 'react';

export function useOnReturn(onReturn: () => void) {
  const handler = useRef(onReturn);

  useEffect(() => {
    handler.current = onReturn;
  });

  useEffect(() => {
    let away = false;

    const leave = () => {
      away = true;
    };

    const arrive = () => {
      if (!away || document.visibilityState !== 'visible') {
        return;
      }

      away = false;
      handler.current();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        arrive();
      } else {
        leave();
      }
    };

    window.addEventListener('blur', leave);
    window.addEventListener('focus', arrive);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', arrive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
