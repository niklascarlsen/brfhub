import type {Resource, Slots} from '@booking/core/api/types';
import {slotOffer, type BookingAction} from '@booking/core/booking/offer';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {View} from 'react-native';

import {Notice, NoticeBar} from '@/components/Notice';
import {TimeSlotListSkeleton, TimeSlotRow} from '@/components/TimeSlotRow';
import {useMessages} from '@/i18n/LocaleProvider';

const FALLBACK_SKELETON_ROWS = 4;

type SlotListProps = {
  // Null until it has loaded.
  day: Slots | null;
  resource: Resource;
  error: string | null;
  onRetry: () => void;
  onSelect: (action: BookingAction) => void;
};

export function SlotList({
  day,
  resource,
  error,
  onRetry,
  onSelect,
}: SlotListProps) {
  const slots = day?.slots ?? null;
  const showSkeleton = useSlowLoad(slots === null && error === null);
  const t = useMessages();

  if (day && slots && slots.length > 0) {
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
          {slots.map((slot) => {
            const offer = slotOffer(slot, resource, day.held, t);

            return (
              <TimeSlotRow
                key={slot.start}
                slot={slot}
                offer={offer}
                onPress={() => {
                  if (offer.action) {
                    onSelect(offer.action);
                  }
                }}
              />
            );
          })}
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
