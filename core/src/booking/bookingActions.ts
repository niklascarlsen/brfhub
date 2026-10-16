import type {Api} from '../api/createApi';
import {codeOf, errorMessage, type ClientErrorCode} from '../api/errors';
import type {HeldBooking} from '../api/types';
import type {Messages} from '../i18n/catalog';
import {formatWhen, unbrokenRange} from '../lib/dates';
import type {Dialog, DialogTime} from '../lib/dialog';
import {exhaustive} from '../lib/exhaustive';

import type {Bookable, BookingAction, Identified} from './offer';

type Times = Omit<Identified, 'id'>;

function shouldReload(code: ClientErrorCode) {
  switch (code) {
    case 'SLOT_TAKEN':
    case 'SLOT_STARTED':
    case 'SLOT_AVAILABLE':
    case 'HAS_ACTIVE_BOOKING':
    case 'NOT_FOUND':
      return true;
    default:
      return false;
  }
}

// The range stays on one line, so a dialog never breaks it at the dash.
function whenOf({date, start, end, resourceName}: Times, t: Messages) {
  return `${resourceName}, ${formatWhen(date, unbrokenRange(start, end), t)}`;
}

function cardOf(
  {date, start, end, resourceName}: Times,
  t: Messages,
  label?: Pick<DialogTime, 'caption' | 'tone'>,
): DialogTime {
  return {
    ...label,
    resource: resourceName,
    when: formatWhen(date, unbrokenRange(start, end), t),
  };
}

type BookingActionsOptions = Api & {
  dialog: Dialog;
  t: Messages;
  // Runs after a change, and after a failure that means the shown slots
  // are out of date.
  onChange?: () => void;
};

// Asks before doing what a time offers, sends it and tells why when it
// fails. Each client binds it in useBookingActions.
export function bookingActions({
  api,
  unwrap,
  dialog,
  t,
  onChange,
}: BookingActionsOptions) {
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

  async function book(target: Bookable, replacing?: HeldBooking) {
    await mutate(t.booking.bookFailed, () =>
      unwrap(
        api.POST('/bookings', {
          body: {
            date: target.date,
            start: target.start,
            resourceId: target.resourceId,
            ...(replacing ? {replaceBookingId: replacing.id} : {}),
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

  // One booking to give up is a yes or no, several a choice of which. The
  // times are shown on cards, since two in one sentence are hard to tell
  // apart.
  function confirmSwap(target: Bookable, choices: HeldBooking[], held: number) {
    const to = cardOf(target, t, {caption: t.booking.swapTo, tone: 'new'});
    const [only] = choices;

    if (choices.length === 1 && only) {
      dialog.confirm(
        t.booking.alreadyHolding(held),
        t.booking.swapQuestion,
        {
          label: t.booking.swap,
          onPress: () => {
            void book(target, only);
          },
        },
        [cardOf(only, t, {caption: t.booking.swapFrom, tone: 'old'}), to],
      );
      return;
    }

    dialog.choose(
      t.booking.chooseSwapTitle,
      t.booking.chooseSwapQuestion,
      choices.map((choice) => ({
        label: whenOf(choice, t),
        time: cardOf(choice, t),
        onPress: () => {
          void book(target, choice);
        },
      })),
      {times: [to], choicesLabel: t.booking.swapChoices},
    );
  }

  function confirmBook(target: Bookable) {
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
        cancelLabel: t.booking.stayInQueue,
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

  function confirm(action: BookingAction) {
    switch (action.kind) {
      case 'book':
        confirmBook(action.target);
        return;
      case 'swap':
        confirmSwap(action.target, action.choices, action.held);
        return;
      case 'full':
        dialog.alert(
          t.booking.alreadyHolding(action.max),
          t.booking.fullUntilOver(action.max),
        );
        return;
      case 'queue':
        confirmSubscribe(action.target);
        return;
      case 'leaveQueue':
        confirmUnsubscribe(action.subscription);
        return;
      case 'cancel':
        confirmCancel(action.booking);
        return;
      case 'release':
        confirmRelease(action.booking);
        return;
      default:
        exhaustive(action);
    }
  }

  return {confirm};
}
