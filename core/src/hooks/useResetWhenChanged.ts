import {useState} from 'react';

export function useResetWhenChanged<T>(value: T, reset: () => void) {
  const [previous, setPrevious] = useState(value);

  if (value !== previous) {
    setPrevious(value);
    reset();
  }
}
