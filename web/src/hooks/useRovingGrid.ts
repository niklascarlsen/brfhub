import {useResetWhenChanged} from '@brfhub/core/hooks/useResetWhenChanged';
import {useState} from 'react';

type Cursor = {row: number; col: number};

type RovingGridOptions = {
  rows: number;
  cols: number;
  // The cursor returns to the first focusable cell whenever this changes.
  resetKey: string;
  canFocus: (row: number, col: number) => boolean;
};

export type RovingCellProps = {
  tabIndex: number;
  'data-cell': string;
  onFocus: () => void;
};

// The two-dimensional sibling of useRovingList. The grid gets one tab stop
// and the arrow keys walk it like a spreadsheet, skipping cells that cannot
// take focus.
export function useRovingGrid({
  rows,
  cols,
  resetKey,
  canFocus,
}: RovingGridOptions) {
  const [cursor, setCursor] = useState<Cursor>({row: 0, col: 0});

  useResetWhenChanged(resetKey, () => setCursor({row: 0, col: 0}));

  function seek(from: Cursor, rowStep: number, colStep: number) {
    let row = from.row + rowStep;
    let col = from.col + colStep;

    while (row >= 0 && row < rows && col >= 0 && col < cols) {
      if (canFocus(row, col)) {
        return {row, col};
      }

      row += rowStep;
      col += colStep;
    }

    return null;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    let next: Cursor | null;

    switch (event.key) {
      case 'ArrowRight':
        next = seek(cursor, 0, 1);
        break;
      case 'ArrowLeft':
        next = seek(cursor, 0, -1);
        break;
      case 'ArrowDown':
        next = seek(cursor, 1, 0);
        break;
      case 'ArrowUp':
        next = seek(cursor, -1, 0);
        break;
      case 'Home':
        next = seek({row: cursor.row, col: -1}, 0, 1);
        break;
      case 'End':
        next = seek({row: cursor.row, col: cols}, 0, -1);
        break;
      default:
        return;
    }

    event.preventDefault();

    if (!next) {
      return;
    }

    setCursor(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-cell="${next.row}-${next.col}"]`)
      ?.focus();
  }

  // A reload can leave the cursor on an unreachable cell. Park the tab stop
  // on the first cell that can take focus.
  let active = cursor;
  if (!canFocus(cursor.row, cursor.col)) {
    active = seek({row: 0, col: -1}, 0, 1) ?? cursor;
  }

  return {
    onKeyDown,
    cellProps: (row: number, col: number): RovingCellProps => ({
      tabIndex: row === active.row && col === active.col ? 0 : -1,
      'data-cell': `${row}-${col}`,
      onFocus: () => setCursor({row, col}),
    }),
  };
}
