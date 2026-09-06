import {useState} from 'react';

import {useResetWhenChanged} from '@/hooks/useResetWhenChanged';

type Orientation = 'horizontal' | 'vertical';

type RovingListOptions = {
  count: number;
  orientation: Orientation;
  resetKey: string;
  startAt?: number;
  isFocusable?: (index: number) => boolean;
};

export type RovingItemProps = {
  tabIndex: number;
  'data-roving': number;
};

export function useRovingList({
  count,
  orientation,
  resetKey,
  startAt = 0,
  isFocusable = () => true,
}: RovingListOptions) {
  const [index, setIndex] = useState(startAt);

  useResetWhenChanged(resetKey, () => setIndex(startAt));

  function seek(from: number, step: number) {
    for (let next = from + step; next >= 0 && next < count; next += step) {
      if (isFocusable(next)) {
        return next;
      }
    }

    return null;
  }

  const [back, forward] =
    orientation === 'horizontal'
      ? ['ArrowLeft', 'ArrowRight']
      : ['ArrowUp', 'ArrowDown'];

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    let next: number | null;

    switch (event.key) {
      case forward:
        next = seek(index, 1);
        break;
      case back:
        next = seek(index, -1);
        break;
      case 'Home':
        next = seek(-1, 1);
        break;
      case 'End':
        next = seek(count, -1);
        break;
      default:
        return;
    }

    event.preventDefault();

    if (next === null) {
      return;
    }

    setIndex(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-roving="${next}"]`)
      ?.focus();
  }

  // A reload can leave the cursor on an unreachable item. Park the tab stop
  // on the first item that can take focus.
  let active = index;
  if (!isFocusable(index)) {
    active = seek(-1, 1) ?? index;
  }

  return {
    orientation,
    onKeyDown,
    itemProps: (item: number): RovingItemProps => ({
      tabIndex: item === active ? 0 : -1,
      'data-roving': item,
    }),
  };
}
