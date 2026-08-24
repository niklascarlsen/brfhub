import {Alert} from 'react-native';

import {api, unwrap, type Booking, type Slot} from '@/api/client';
import {ApiError, errorMessage} from '@/api/errors';
import {formatWhen, timeRange} from '@/lib/dates';

function codeOf(error: unknown) {
  return error instanceof ApiError ? error.code : 'UNKNOWN';
}

export function useBookingActions(onChange?: () => void) {
  async function book(slot: Slot, date: string, replaceExisting = false) {
    try {
      await unwrap(
        api.POST('/bookings', {
          body: {
            date,
            slotId: slot.id,
            ...(replaceExisting ? {replaceExisting: true} : {}),
          },
        }),
      );
      onChange?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'HAS_ACTIVE_BOOKING') {
        confirmSwap(slot, date);
        return;
      }

      if (error instanceof ApiError && error.code === 'SLOT_TAKEN') {
        onChange?.();
      }

      if (error instanceof ApiError && error.code === 'SLOT_STARTED') {
        onChange?.();
      }

      Alert.alert('Kunde inte boka', errorMessage(codeOf(error)));
    }
  }

  function confirmSwap(slot: Slot, date: string) {
    Alert.alert(
      'Du har redan en bokning',
      `Vill du byta till ${formatWhen(date, timeRange(slot.start, slot.end))}?`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Byt',
          isPreferred: true,
          onPress: () => {
            void book(slot, date, true);
          },
        },
      ],
    );
  }

  async function subscribe(slot: Slot, date: string) {
    try {
      await unwrap(api.POST('/subscriptions', {body: {date, slotId: slot.id}}));
      onChange?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SLOT_AVAILABLE') {
        onChange?.();
      }

      Alert.alert('Kunde inte köa', errorMessage(codeOf(error)));
    }
  }

  async function unsubscribe(id: string) {
    try {
      await unwrap(api.DELETE('/subscriptions/{id}', {params: {path: {id}}}));
      onChange?.();
    } catch (error) {
      Alert.alert('Kunde inte lämna kön', errorMessage(codeOf(error)));
    }
  }

  function confirmSubscribe(slot: Slot, date: string) {
    if (slot.status !== 'booked') {
      return;
    }

    const when = formatWhen(date, timeRange(slot.start, slot.end));

    if (slot.subscriptionId) {
      confirmUnsubscribe({id: slot.subscriptionId, when});
      return;
    }

    Alert.alert(
      'Ställ dig i kö',
      `Vi meddelar dig om ${when} blir ledig. Först till kvarn gäller.`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Ställ mig i kö',
          isPreferred: true,
          onPress: () => {
            void subscribe(slot, date);
          },
        },
      ],
    );
  }

  function confirmUnsubscribe({id, when}: {id: string; when: string}) {
    Alert.alert('Lämna kön', `Vill du lämna kön för ${when}?`, [
      {text: 'Avbryt', style: 'cancel'},
      {
        text: 'Lämna kön',
        style: 'destructive',
        onPress: () => {
          void unsubscribe(id);
        },
      },
    ]);
  }

  function confirmBook(slot: Slot, date: string, active: Booking | null) {
    if (slot.status === 'walkin') {
      Alert.alert(
        'Drop-in',
        'Tiden har börjat. Gå ner och kolla om rummet är ledigt.',
      );
      return;
    }

    if (slot.status === 'booked') {
      confirmSubscribe(slot, date);
      return;
    }

    if (slot.status === 'mine') {
      confirmCancel({
        id: slot.bookingId,
        when: formatWhen(date, timeRange(slot.start, slot.end)),
      });
      return;
    }

    if (active) {
      confirmSwap(slot, date);
      return;
    }

    Alert.alert(
      'Boka tid',
      `Vill du boka ${formatWhen(date, timeRange(slot.start, slot.end))}?`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Boka',
          isPreferred: true,
          onPress: () => {
            void book(slot, date);
          },
        },
      ],
    );
  }

  async function cancel(id: string) {
    try {
      await unwrap(api.DELETE('/bookings/{id}', {params: {path: {id}}}));
      onChange?.();
    } catch (error) {
      Alert.alert('Kunde inte avboka', errorMessage(codeOf(error)));
    }
  }

  function confirmCancel({id, when}: {id: string; when: string}) {
    Alert.alert('Avboka tid', `Vill du avboka ${when}?`, [
      {text: 'Avbryt', style: 'cancel'},
      {
        text: 'Avboka',
        style: 'destructive',
        onPress: () => {
          void cancel(id);
        },
      },
    ]);
  }

  return {confirmBook, confirmCancel, confirmUnsubscribe};
}
