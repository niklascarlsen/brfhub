import {
  codeOf,
  errorMessage,
  type ClientErrorCode,
} from '@booking/core/api/errors';
import type {
  ActiveBooking,
  Booking,
  Resource,
  Slot,
} from '@booking/core/api/types';
import type {Messages} from '@booking/core/i18n/catalog';
import {formatWhen, timeRange} from '@booking/core/lib/dates';
import {exhaustive} from '@booking/core/lib/exhaustive';

import {api, unwrap} from '@/api/client';
import {useDialog} from '@/components/Dialog';
import {useMessages} from '@/i18n/LocaleProvider';

type Times = Pick<Booking, 'date' | 'start' | 'end' | 'resourceName'>;
type Bookable = Times & Pick<Booking, 'resourceId'>;
type Identified = Times & Pick<Booking, 'id'>;

function shouldReload(code: ClientErrorCode) {
  switch (code) {
    case 'SLOT_TAKEN':
    case 'SLOT_STARTED':
    case 'SLOT_AVAILABLE':
    case 'HAS_ACTIVE_BOOKING':
      return true;
    default:
      return false;
  }
}

function whenOf({date, start, end, resourceName}: Times, t: Messages) {
  return `${resourceName}, ${formatWhen(date, timeRange(start, end), t)}`;
}

export function useBookingActions(onChange?: () => void) {
  const dialog = useDialog();
  const t = useMessages();

  async function mutate(failTitle: string, request: () => Promise<unknown>) {
    try {
      await request();
      onChange?.();
    } catch (error) {
      const code = codeOf(error);
      if (shouldReload(code)) {
        onChange?.();
      }
      dialog.alert(failTitle, errorMessage(code, t));
    }
  }

  async function book(target: Bookable, replaceExisting = false) {
    await mutate(t.booking.bookFailed, () =>
      unwrap(
        api.POST('/bookings', {
          body: {
            date: target.date,
            start: target.start,
            resourceId: target.resourceId,
            ...(replaceExisting ? {replaceExisting: true} : {}),
          },
        }),
      ),
    );
  }

  async function subscribe(target: Bookable) {
    await mutate(t.booking.queueFailed, () =>
      unwrap(
        api.POST('/subscriptions', {
          body: {
            date: target.date,
            start: target.start,
            resourceId: target.resourceId,
          },
        }),
      ),
    );
  }

  async function unsubscribe(id: string) {
    await mutate(t.booking.leaveQueueFailed, () =>
      unwrap(api.DELETE('/subscriptions/{id}', {params: {path: {id}}})),
    );
  }

  async function cancel(id: string) {
    await mutate(t.booking.cancelFailed, () =>
      unwrap(api.DELETE('/bookings/{id}', {params: {path: {id}}})),
    );
  }

  async function release(id: string) {
    await mutate(t.booking.releaseFailed, () =>
      unwrap(api.DELETE('/bookings/{id}', {params: {path: {id}}})),
    );
  }

  function confirmSwap(target: Bookable) {
    dialog.confirm(
      t.booking.alreadyBookedTitle,
      t.booking.swapQuestion(whenOf(target, t)),
      {
        label: t.booking.swap,
        onPress: () => {
          void book(target, true);
        },
      },
    );
  }

  function confirmSubscribe(target: Bookable) {
    dialog.confirm(
      t.booking.queueTitle,
      t.booking.queueQuestion(whenOf(target, t)),
      {
        label: t.booking.queueMe,
        onPress: () => {
          void subscribe(target);
        },
      },
    );
  }

  function confirmUnsubscribe(subscription: Identified) {
    dialog.confirm(
      t.times.leaveQueue,
      t.booking.leaveQueueQuestion(whenOf(subscription, t)),
      {
        label: t.times.leaveQueue,
        destructive: true,
        onPress: () => {
          void unsubscribe(subscription.id);
        },
      },
    );
  }

  function confirmCancel(booking: Identified) {
    dialog.confirm(
      t.booking.cancelTitle,
      t.booking.cancelQuestion(whenOf(booking, t)),
      {
        label: t.times.cancel,
        destructive: true,
        onPress: () => {
          void cancel(booking.id);
        },
      },
    );
  }

  function confirmRelease(booking: Identified) {
    dialog.confirm(
      t.booking.releaseTitle,
      t.booking.releaseQuestion(whenOf(booking, t)),
      {
        label: t.times.done,
        onPress: () => {
          void release(booking.id);
        },
      },
    );
  }

  function confirmBookable(target: Bookable, active: ActiveBooking | null) {
    if (active?.released) {
      dialog.alert(t.booking.alreadyBookedTitle, t.booking.releasedBlocks);
      return;
    }

    if (active) {
      confirmSwap(target);
      return;
    }

    dialog.confirm(
      t.booking.bookTitle,
      t.booking.bookQuestion(whenOf(target, t)),
      {
        label: t.times.book,
        onPress: () => {
          void book(target);
        },
      },
    );
  }

  function confirmBook(
    slot: Slot,
    resource: Resource,
    active: ActiveBooking | null,
  ) {
    const times = {
      date: slot.date,
      start: slot.start,
      end: slot.end,
      resourceName: resource.name,
    };

    switch (slot.status) {
      case 'available':
        confirmBookable({...times, resourceId: resource.id}, active);
        return;
      case 'walkin':
        return;
      case 'booked':
        if (slot.started) {
          return;
        }

        if (slot.subscriptionId) {
          confirmUnsubscribe({...times, id: slot.subscriptionId});
          return;
        }

        confirmSubscribe({...times, resourceId: resource.id});
        return;
      case 'mine':
        if (slot.started) {
          confirmRelease({...times, id: slot.bookingId});
          return;
        }

        confirmCancel({...times, id: slot.bookingId});
        return;
      default:
        exhaustive(slot);
    }
  }

  return {
    confirmBook,
    confirmBookable,
    confirmCancel,
    confirmRelease,
    confirmUnsubscribe,
  };
}
