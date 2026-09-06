import {Fragment} from 'react';

import type {Slot} from '@/api/client';
import {LockClosedIcon} from '@/components/icons';
import {Notice, NoticeBar} from '@/components/Notice';
import {Skeleton} from '@/components/Skeleton';
import {useRovingGrid, type RovingCellProps} from '@/hooks/useRovingGrid';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {fromIsoDate, getWeekdayLabel} from '@/lib/dates';
import {isLocked, slotAppearance} from '@/lib/slots';

const FALLBACK_SKELETON_ROWS = 5;

// Padding on cells breaks flex-basis alignment. Grid tracks do not.
const GRID = 'grid grid-cols-[96px_repeat(7,minmax(0,1fr))] gap-2';

type WeekGridProps = {
  slots: Slot[] | null;
  days: string[];
  resourceId: string;
  todayIso: string;
  lastIso: string;
  error: string | null;
  onRetry: () => void;
  onSelect: (slot: Slot) => void;
};

type Row = {start: string; end: string};

// The server drops slots that have ended, so the rows are the union of what
// came back rather than a fixed timetable.
function rowsOf(slots: Slot[]): Row[] {
  const rows = new Map<string, Row>();

  for (const slot of slots) {
    if (!rows.has(slot.start)) {
      rows.set(slot.start, {start: slot.start, end: slot.end});
    }
  }

  return [...rows.values()].sort((a, b) => a.start.localeCompare(b.start));
}

// One cell per row and weekday. A day without that start time gets undefined.
function gridOf(
  slots: Slot[],
  days: string[],
  rows: Row[],
): (Slot | undefined)[][] {
  return rows.map((row) =>
    days.map((day) =>
      slots.find((slot) => slot.date === day && slot.start === row.start),
    ),
  );
}

function DayHeader({
  isoDate,
  todayIso,
  lastIso,
}: {
  isoDate: string;
  todayIso: string;
  lastIso: string;
}) {
  const day = fromIsoDate(isoDate);
  const outside = isoDate > lastIso;

  let numberTone = 'text-theme-ink';
  if (outside) {
    numberTone = 'text-theme-edge';
  } else if (isoDate === todayIso) {
    numberTone = 'text-theme-accent';
  }

  return (
    <div
      role='columnheader'
      className='flex flex-col items-center gap-0.5 pb-2.5'
    >
      <span
        className={`text-xs font-medium ${
          outside ? 'text-theme-edge' : 'text-theme-muted'
        }`}
      >
        {getWeekdayLabel(day)}
      </span>
      <span className={`text-[17px] font-semibold tabular-nums ${numberTone}`}>
        {day.getDate()}
      </span>
    </div>
  );
}

function WeekGridSkeleton({days}: {days: string[]}) {
  return (
    <Skeleton>
      <div className={GRID}>
        {Array.from({length: FALLBACK_SKELETON_ROWS}, (_, row) => (
          <Fragment key={row}>
            <div />
            {days.map((isoDate) => (
              <div
                key={isoDate}
                className='h-20 rounded-[14px] border border-theme-line bg-theme-surface'
              />
            ))}
          </Fragment>
        ))}
      </div>
    </Skeleton>
  );
}

function EmptyCell({outside}: {outside: boolean}) {
  return (
    <div
      role='gridcell'
      aria-hidden={outside}
      className='flex h-20 items-center justify-center rounded-[14px] bg-theme-sunk/50 px-3'
    >
      {outside ? null : (
        <span className='text-[13px] font-medium text-theme-edge'>
          Passerat
        </span>
      )}
    </div>
  );
}

function SlotCell({
  slot,
  cellProps,
  onSelect,
}: {
  slot: Slot;
  cellProps: RovingCellProps;
  onSelect: (slot: Slot) => void;
}) {
  const {surface, label, tone, mark} = slotAppearance(slot);
  const locked = isLocked(slot);

  return (
    <div role='gridcell'>
      <button
        type='button'
        {...cellProps}
        onClick={() => onSelect(slot)}
        disabled={locked}
        className={`flex h-20 w-full items-center justify-center rounded-[14px] px-3 ${surface} ${
          locked
            ? ''
            : 'transition-colors hover:border-theme-accent active:opacity-80'
        }`}
      >
        <span className='flex items-center gap-1.5'>
          {mark === 'dot' ? (
            <span className='h-1.5 w-1.5 rounded-full bg-theme-accent' />
          ) : null}
          {mark === 'lock' ? (
            <LockClosedIcon size={12} className='text-theme-faint' />
          ) : null}
          <span className={`text-[13px] ${tone}`}>{label}</span>
        </span>
      </button>
    </div>
  );
}

export function WeekGrid({
  slots,
  days,
  resourceId,
  todayIso,
  lastIso,
  error,
  onRetry,
  onSelect,
}: WeekGridProps) {
  const showSkeleton = useSlowLoad(slots === null && error === null);

  const loadedSlots = slots ?? [];
  const rows = rowsOf(loadedSlots);
  const grid = gridOf(loadedSlots, days, rows);

  const roving = useRovingGrid({
    rows: rows.length,
    cols: days.length,
    resetKey: `${days[0]}:${resourceId}`,
    canFocus: (row, col) => {
      const slot = grid[row]?.[col];
      return slot !== undefined && !isLocked(slot);
    },
  });

  if (!slots) {
    if (error) {
      return (
        <Notice message={error} actionLabel='Försök igen' onAction={onRetry} />
      );
    }

    return showSkeleton ? <WeekGridSkeleton days={days} /> : null;
  }

  if (rows.length === 0) {
    return <Notice message='Inga tider kvar den här veckan' />;
  }

  return (
    <div className='flex flex-col gap-2.5'>
      {error ? (
        <NoticeBar
          message={error}
          actionLabel='Försök igen'
          onAction={onRetry}
        />
      ) : null}
      <div
        role='grid'
        aria-label='Tider den här veckan'
        onKeyDown={roving.onKeyDown}
        className={GRID}
      >
        <div role='row' className='contents'>
          <div role='columnheader' />
          {days.map((isoDate) => (
            <DayHeader
              key={isoDate}
              isoDate={isoDate}
              todayIso={todayIso}
              lastIso={lastIso}
            />
          ))}
        </div>
        {rows.map((row, rowIndex) => (
          <div role='row' className='contents' key={row.start}>
            <div role='rowheader' className='flex items-center pr-1'>
              <span className='text-[15px] font-semibold tracking-tight tabular-nums'>
                <span className='text-theme-ink'>{row.start}</span>
                <span className='text-theme-faint'>–{row.end}</span>
              </span>
            </div>
            {days.map((isoDate, colIndex) => {
              const slot = grid[rowIndex]?.[colIndex];

              return slot ? (
                <SlotCell
                  key={isoDate}
                  slot={slot}
                  cellProps={roving.cellProps(rowIndex, colIndex)}
                  onSelect={onSelect}
                />
              ) : (
                <EmptyCell key={isoDate} outside={isoDate > lastIso} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
