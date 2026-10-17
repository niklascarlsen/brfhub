import type {Held, Resource, Slot, Slots} from '@brfhub/core/api/types';
import {slotOffer, type BookingAction} from '@brfhub/core/booking/offer';
import {useSlowLoad} from '@brfhub/core/hooks/useSlowLoad';

import {Notice, NoticeBar} from '@/components/Notice';
import {TimeSlotListSkeleton, TimeSlotRow} from '@/components/TimeSlotRow';
import {useRovingList} from '@/hooks/useRovingList';
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

function SlotRows({
  slots,
  held,
  resource,
  onSelect,
}: {
  slots: Slot[];
  held: Held;
  resource: Resource;
  onSelect: (action: BookingAction) => void;
}) {
  const t = useMessages();
  const offers = slots.map((slot) => slotOffer(slot, resource, held, t));
  const roving = useRovingList({
    count: slots.length,
    orientation: 'vertical',
    resetKey: `${slots[0].date}:${resource.id}`,
    startAt: Math.max(
      offers.findIndex((offer) => !offer.locked),
      0,
    ),
    isFocusable: (index) => !offers[index].locked,
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
          offer={offers[index]}
          onPress={() => {
            const {action} = offers[index];
            if (action) {
              onSelect(action);
            }
          }}
          itemProps={roving.itemProps(index)}
        />
      ))}
    </div>
  );
}

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
        <SlotRows
          slots={slots}
          held={day.held}
          resource={resource}
          onSelect={onSelect}
        />
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
