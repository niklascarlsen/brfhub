import {Alert} from 'react-native';

import {
  api,
  unwrap,
  type Booking,
  type Resource,
  type Slot,
} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import {formatWhen, timeRange} from '@/lib/dates';
import {exhaustive} from '@/lib/exhaustive';

type Times = Pick<Booking, 'date' | 'start' | 'end' | 'resourceName'>;
type Bookable = Times & Pick<Booking, 'slotId' | 'resourceId'>;
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

function whenOf({date, start, end, resourceName}: Times) {
  return `${resourceName}, ${formatWhen(date, timeRange(start, end))}`;
}

function confirm(
  title: string,
  message: string,
  action: {label: string; destructive?: boolean; onPress: () => void},
) {
  Alert.alert(title, message, [
    {text: 'Avbryt', style: 'cancel'},
    action.destructive
      ? {text: action.label, style: 'destructive', onPress: action.onPress}
      : {text: action.label, isPreferred: true, onPress: action.onPress},
  ]);
}

export function useBookingActions(onChange?: () => void) {
  async function mutate(failTitle: string, request: () => Promise<unknown>) {
    try {
      await request();
      onChange?.();
    } catch (error) {
      const code = codeOf(error);
      if (shouldReload(code)) {
        onChange?.();
      }
      Alert.alert(failTitle, errorMessage(code));
    }
  }

  async function book(target: Bookable, replaceExisting = false) {
    await mutate('Kunde inte boka', () =>
      unwrap(
        api.POST('/bookings', {
          body: {
            date: target.date,
            slotId: target.slotId,
            resourceId: target.resourceId,
            ...(replaceExisting ? {replaceExisting: true} : {}),
          },
        }),
      ),
    );
  }

  async function subscribe(target: Bookable) {
    await mutate('Kunde inte köa', () =>
      unwrap(
        api.POST('/subscriptions', {
          body: {
            date: target.date,
            slotId: target.slotId,
            resourceId: target.resourceId,
          },
        }),
      ),
    );
  }

  async function unsubscribe(id: string) {
    await mutate('Kunde inte lämna kön', () =>
      unwrap(api.DELETE('/subscriptions/{id}', {params: {path: {id}}})),
    );
  }

  async function cancel(id: string) {
    await mutate('Kunde inte avboka', () =>
      unwrap(api.DELETE('/bookings/{id}', {params: {path: {id}}})),
    );
  }

  async function release(id: string) {
    await mutate('Kunde inte öppna tiden', () =>
      unwrap(api.DELETE('/bookings/{id}', {params: {path: {id}}})),
    );
  }

  function confirmSwap(target: Bookable) {
    confirm('Du har redan en bokning', `Vill du byta till ${whenOf(target)}?`, {
      label: 'Byt',
      onPress: () => {
        void book(target, true);
      },
    });
  }

  function confirmSubscribe(target: Bookable) {
    confirm(
      'Ställ dig i kö',
      `Vi meddelar dig om ${whenOf(target)} blir ledig. Först till kvarn gäller.`,
      {
        label: 'Ställ mig i kö',
        onPress: () => {
          void subscribe(target);
        },
      },
    );
  }

  function confirmUnsubscribe(subscription: Identified) {
    confirm('Lämna kön', `Vill du lämna kön för ${whenOf(subscription)}?`, {
      label: 'Lämna kön',
      destructive: true,
      onPress: () => {
        void unsubscribe(subscription.id);
      },
    });
  }

  function confirmCancel(booking: Identified) {
    confirm('Avboka tid', `Vill du avboka ${whenOf(booking)}?`, {
      label: 'Avboka',
      destructive: true,
      onPress: () => {
        void cancel(booking.id);
      },
    });
  }

  function confirmRelease(booking: Identified) {
    confirm(
      'Öppna för drop-in',
      `Andra kan ta ${whenOf(booking)} som drop-in. Du kan inte boka en ny tid förrän luckan är slut.`,
      {
        label: 'Jag är klar',
        onPress: () => {
          void release(booking.id);
        },
      },
    );
  }

  function confirmBookable(target: Bookable, active: Booking | null) {
    if (active?.released) {
      Alert.alert(
        'Du har redan en bokning',
        'Du kan inte boka en ny tid förrän luckan är slut.',
      );
      return;
    }

    if (active) {
      confirmSwap(target);
      return;
    }

    confirm('Boka tid', `Vill du boka ${whenOf(target)}?`, {
      label: 'Boka',
      onPress: () => {
        void book(target);
      },
    });
  }

  function confirmBook(
    slot: Slot,
    date: string,
    resource: Resource,
    active: Booking | null,
  ) {
    const times = {
      date,
      start: slot.start,
      end: slot.end,
      resourceName: resource.name,
    };

    switch (slot.status) {
      case 'available':
        confirmBookable(
          {...times, slotId: slot.id, resourceId: resource.id},
          active,
        );
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

        confirmSubscribe({...times, slotId: slot.id, resourceId: resource.id});
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
