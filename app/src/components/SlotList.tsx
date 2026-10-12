import type {Slot} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {View} from 'react-native';

import {Notice, NoticeBar} from '@/components/Notice';
import {TimeSlotListSkeleton, TimeSlotRow} from '@/components/TimeSlotRow';
import {useMessages} from '@/i18n/LocaleProvider';

const FALLBACK_SKELETON_ROWS = 4;

type SlotListProps = {
  slots: Slot[] | null;
  error: string | null;
  onRetry: () => void;
  onSelect: (slot: Slot) => void;
};

export function SlotList({slots, error, onRetry, onSelect}: SlotListProps) {
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
        <View className='gap-[9px]'>
          {slots.map((slot) => (
            <TimeSlotRow
              key={slot.start}
              slot={slot}
              onPress={() => onSelect(slot)}
            />
          ))}
        </View>
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
