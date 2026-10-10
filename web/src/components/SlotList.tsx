import type {Slot} from '@/api/client';
import {Notice, NoticeBar} from '@/components/Notice';
import {TimeSlotListSkeleton, TimeSlotRow} from '@/components/TimeSlotRow';
import {useRovingList} from '@/hooks/useRovingList';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import {isLocked} from '@/lib/slots';

const FALLBACK_SKELETON_ROWS = 4;

type SlotListProps = {
  slots: Slot[] | null;
  resourceId: string;
  error: string | null;
  onRetry: () => void;
  onSelect: (slot: Slot) => void;
};

function SlotRows({
  slots,
  resourceId,
  onSelect,
}: {
  slots: Slot[];
  resourceId: string;
  onSelect: (slot: Slot) => void;
}) {
  const t = useMessages();
  const roving = useRovingList({
    count: slots.length,
    orientation: 'vertical',
    resetKey: `${slots[0].date}:${resourceId}`,
    startAt: Math.max(
      slots.findIndex((slot) => !isLocked(slot)),
      0,
    ),
    isFocusable: (index) => !isLocked(slots[index]),
  });

  return (
    <div
      role='toolbar'
      aria-label={t.booking.slotsOfDay}
      aria-orientation={roving.orientation}
      onKeyDown={roving.onKeyDown}
      className='flex flex-col gap-2.25'
    >
      {slots.map((slot, index) => (
        <TimeSlotRow
          key={slot.start}
          slot={slot}
          onPress={() => onSelect(slot)}
          itemProps={roving.itemProps(index)}
        />
      ))}
    </div>
  );
}

export function SlotList({
  slots,
  resourceId,
  error,
  onRetry,
  onSelect,
}: SlotListProps) {
  const showSkeleton = useSlowLoad(slots === null && error === null);
  const t = useMessages();

  if (slots && slots.length > 0) {
    return (
      <>
        {error ? (
          <NoticeBar
            message={error}
            actionLabel={t.common.retry}
            onAction={onRetry}
          />
        ) : null}
        <SlotRows slots={slots} resourceId={resourceId} onSelect={onSelect} />
      </>
    );
  }

  if (error) {
    return (
      <Notice message={error} actionLabel={t.common.retry} onAction={onRetry} />
    );
  }

  if (slots) {
    return <Notice message={t.booking.noSlotsLeft} />;
  }

  return showSkeleton ? (
    <TimeSlotListSkeleton rows={FALLBACK_SKELETON_ROWS} />
  ) : null;
}
