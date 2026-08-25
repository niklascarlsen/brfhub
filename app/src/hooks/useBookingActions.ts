import {Alert} from 'react-native';

import {api, unwrap, type Booking, type Slot} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import {formatWhen, timeRange} from '@/lib/dates';

type Times = Pick<Booking, 'date' | 'start' | 'end'>;
type Bookable = Times & Pick<Booking, 'slotId'>;
type Identified = Times & Pick<Booking, 'id'>;

type Recovery = Partial<Record<ClientErrorCode, () => void>>;

const REFRESH_ON: ClientErrorCode[] = [
  'SLOT_TAKEN',
  'SLOT_STARTED',
  'SLOT_AVAILABLE',
];

function whenOf({date, start, end}: Times) {
  return formatWhen(date, timeRange(start, end));
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
  async function mutate(
    failTitle: string,
    request: () => Promise<unknown>,
    recover: Recovery = {},
  ) {
    try {
      await request();
      onChange?.();
    } catch (error) {
      const code = codeOf(error);
      const recovery = recover[code];

      if (recovery) {
        recovery();
        return;
      }

      if (REFRESH_ON.includes(code)) {
        onChange?.();
      }

      Alert.alert(failTitle, errorMessage(code));
    }
  }

  async function book(target: Bookable, replaceExisting = false) {
    await mutate(
      'Kunde inte boka',
      () =>
        unwrap(
          api.POST('/bookings', {
            body: {
              date: target.date,
              slotId: target.slotId,
              ...(replaceExisting ? {replaceExisting: true} : {}),
            },
          }),
        ),
      replaceExisting ? {} : {HAS_ACTIVE_BOOKING: () => confirmSwap(target)},
    );
  }

  async function subscribe(target: Bookable) {
    await mutate('Kunde inte köa', () =>
      unwrap(
        api.POST('/subscriptions', {
          body: {date: target.date, slotId: target.slotId},
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

  function confirmBookable(target: Bookable, active: Booking | null) {
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

  function confirmBook(slot: Slot, date: string, active: Booking | null) {
    const times = {date, start: slot.start, end: slot.end};

    switch (slot.status) {
      case 'available':
        confirmBookable({...times, slotId: slot.id}, active);
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

        confirmSubscribe({...times, slotId: slot.id});
        return;
      case 'mine':
        confirmCancel({...times, id: slot.bookingId});
    }
  }

  return {confirmBook, confirmBookable, confirmCancel, confirmUnsubscribe};
}
