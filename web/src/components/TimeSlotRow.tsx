import type {Slot} from '@/api/client';
import {ChevronForwardIcon, LockClosedIcon} from '@/components/icons';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import type {RovingItemProps} from '@/hooks/useRovingList';
import {useMessages} from '@/i18n/LocaleProvider';
import {timeRange} from '@/lib/dates';
import {isLocked, slotAppearance} from '@/lib/slots';

type TimeSlotRowProps = {
  slot: Slot;
  onPress: () => void;
  itemProps: RovingItemProps;
};

export function TimeSlotRow({slot, onPress, itemProps}: TimeSlotRowProps) {
  const locked = isLocked(slot);
  const t = useMessages();
  const {surface, time, label, tone, mark, chevron} = slotAppearance(slot, t);

  return (
    <button
      type='button'
      onClick={onPress}
      disabled={locked}
      {...itemProps}
      className={`flex h-16.5 w-full items-center justify-between rounded-2xl px-4.5 ${surface} ${
        locked
          ? ''
          : 'transition-colors hover:border-theme-accent active:opacity-80'
      }`}
    >
      <span
        className={`text-[17px] font-semibold tracking-tight tabular-nums ${time}`}
      >
        {timeRange(slot.start, slot.end)}
      </span>
      <span className='flex items-center gap-2'>
        {mark === 'dot' ? (
          <span className='h-1.5 w-1.5 rounded-full bg-theme-accent' />
        ) : null}
        {mark === 'lock' ? (
          <LockClosedIcon size={13} className='text-theme-faint' />
        ) : null}
        <span className={`text-[13px] ${tone}`}>{label}</span>
        {chevron ? (
          <ChevronForwardIcon size={15} className='text-theme-edge' />
        ) : null}
      </span>
    </button>
  );
}

function TimeSlotRowSkeleton() {
  return (
    <div className='flex h-16.5 w-full items-center justify-between rounded-2xl border border-theme-line bg-theme-surface px-4.5'>
      <SkeletonBar className='h-3.5 w-27' />
      <SkeletonBar className='h-3 w-11' />
    </div>
  );
}

export function TimeSlotListSkeleton({rows}: {rows: number}) {
  return (
    <Skeleton>
      <div className='flex flex-col gap-2.25'>
        {Array.from({length: rows}, (_, row) => (
          <TimeSlotRowSkeleton key={row} />
        ))}
      </div>
    </Skeleton>
  );
}
