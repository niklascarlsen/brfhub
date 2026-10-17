import type {
  Booking,
  Held,
  HeldBooking,
  Resource,
  Slot,
  Subscription,
} from '../api/types';
import type {Messages} from '../i18n/catalog';
import {exhaustive} from '../lib/exhaustive';

type Times = Pick<Booking, 'date' | 'start' | 'end' | 'resourceName'>;
export type Bookable = Times & Pick<Booking, 'resourceId'>;
export type Identified = Times & Pick<Booking, 'id'>;

// What pressing a time does. bookingActions asks first and then does it.
export type BookingAction =
  | {kind: 'book'; target: Bookable}
  // The kind's cap is reached: give up one of the choices for the target.
  // held counts every booking of the kind, choices only those that can go.
  | {kind: 'swap'; target: Bookable; choices: HeldBooking[]; held: number}
  // The cap is reached and every booking held has started or been
  // released, so nothing can be given up until one is over.
  | {kind: 'full'; max: number}
  | {kind: 'queue'; target: Bookable}
  | {kind: 'leaveQueue'; subscription: Identified}
  | {kind: 'cancel'; booking: Identified}
  | {kind: 'release'; booking: Identified};

// Taking a free time: a booking under the cap, a swap at it, or nothing
// to give up.
export function takeAction(target: Bookable, held: Held): BookingAction {
  if (held.bookings.length < held.max) {
    return {kind: 'book', target};
  }

  const choices = held.bookings.filter(
    (booking) => !booking.started && !booking.released,
  );

  return choices.length > 0
    ? {kind: 'swap', target, choices, held: held.bookings.length}
    : {kind: 'full', max: held.max};
}

// The clients map look, tone and mark to their own classes.
export type SlotLook = 'mine' | 'freeNow' | 'free' | 'closed';
export type SlotTone = 'strong' | 'accent' | 'muted' | 'faint';

export type SlotOffer = {
  look: SlotLook;
  label: string;
  tone: SlotTone;
  mark: 'dot' | 'lock' | null;
  // A locked time cannot be pressed, and action is then null.
  locked: boolean;
  action: BookingAction | null;
};

// What a time in the day view says and does for the apartment.
export function slotOffer(
  slot: Slot,
  resource: Pick<Resource, 'id' | 'name'>,
  held: Held,
  t: Messages,
): SlotOffer {
  const times = {
    date: slot.date,
    start: slot.start,
    end: slot.end,
    resourceName: resource.name,
  };
  const target = {...times, resourceId: resource.id};

  switch (slot.status) {
    case 'mine':
      return {
        look: 'mine',
        label: t.slots.mine,
        tone: 'strong',
        mark: 'dot',
        locked: false,
        action: slot.started
          ? {kind: 'release', booking: {...times, id: slot.bookingId}}
          : {kind: 'cancel', booking: {...times, id: slot.bookingId}},
      };
    case 'available':
      return {
        ...(slot.subscriptionId
          ? {look: 'freeNow', label: t.slots.freeNow, tone: 'strong'}
          : {look: 'free', label: t.slots.free, tone: 'muted'}),
        mark: null,
        locked: false,
        action: takeAction(target, held),
      };
    case 'walkin':
      return {
        look: 'closed',
        label: t.slots.dropIn,
        tone: 'faint',
        mark: 'lock',
        locked: true,
        action: null,
      };
    case 'booked':
      return {
        look: 'closed',
        label: slot.subscriptionId ? t.slots.queued : t.slots.taken,
        tone: slot.subscriptionId ? 'accent' : 'faint',
        mark: slot.started ? 'lock' : null,
        locked: slot.started,
        action: slot.started
          ? null
          : slot.subscriptionId
            ? {
                kind: 'leaveQueue',
                subscription: {...times, id: slot.subscriptionId},
              }
            : {kind: 'queue', target},
      };
    default:
      return exhaustive(slot);
  }
}

export type CardOffer = {
  // Over for the apartment: drawn faded, with nothing to press.
  ended: boolean;
  badge: {label: string; tone: 'accent' | 'muted'} | null;
  primary: {label: string; solid: boolean; action: BookingAction} | null;
  secondary: {label: string; action: BookingAction} | null;
};

// A booking in My times: ended once released, which a started booking is
// when the apartment is done and opens it for drop-in, otherwise cancelled.
export function bookingCard(booking: Booking, t: Messages): CardOffer {
  if (booking.released) {
    return {
      ended: true,
      badge: {label: t.times.ended, tone: 'muted'},
      primary: null,
      secondary: null,
    };
  }

  return {
    ended: false,
    badge: null,
    primary: booking.started
      ? {label: t.times.done, solid: false, action: {kind: 'release', booking}}
      : {
          label: t.times.cancel,
          solid: false,
          action: {kind: 'cancel', booking},
        },
    secondary: null,
  };
}

// A queue place in My times: once its time is free and has not started,
// taking it is offered the way the day view offers it.
export function queueCard(subscription: Subscription, t: Messages): CardOffer {
  const leave: BookingAction = {kind: 'leaveQueue', subscription};

  if (!subscription.available) {
    return {
      ended: false,
      badge: {label: t.times.queue, tone: 'muted'},
      primary: {label: t.times.leaveQueue, solid: false, action: leave},
      secondary: null,
    };
  }

  if (subscription.started) {
    return {
      ended: false,
      badge: {label: t.times.dropIn, tone: 'accent'},
      primary: {label: t.times.leaveQueue, solid: false, action: leave},
      secondary: null,
    };
  }

  return {
    ended: false,
    badge: {label: t.times.freeNow, tone: 'accent'},
    primary: {
      label: t.times.book,
      solid: true,
      action: takeAction(subscription, subscription.held),
    },
    secondary: {label: t.times.leaveQueue, action: leave},
  };
}
