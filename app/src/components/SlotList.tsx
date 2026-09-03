import {View} from 'react-native';

import type {Slot} from '@/api/client';
import {Notice, NoticeBar} from '@/components/Notice';
import {TimeSlotListSkeleton, TimeSlotRow} from '@/components/TimeSlotRow';
import {useSlowLoad} from '@/hooks/useSlowLoad';

const FALLBACK_SKELETON_ROWS = 4;

type SlotListProps = {
  slots: Slot[] | null;
  error: string | null;
  onRetry: () => void;
  onSelect: (slot: Slot) => void;
};

export function SlotList({slots, error, onRetry, onSelect}: SlotListProps) {
  const showSkeleton = useSlowLoad(slots === null && error === null);

  if (slots && slots.length > 0) {
    return (
      <>
        {error ? (
          <NoticeBar
            message={error}
            actionLabel='Försök igen'
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
      <Notice message={error} actionLabel='Försök igen' onAction={onRetry} />
    );
  }

  if (slots) {
    return <Notice message='Inga tider kvar den här dagen' />;
  }

  return showSkeleton ? (
    <TimeSlotListSkeleton rows={FALLBACK_SKELETON_ROWS} />
  ) : null;
}
