import type {CancelledBooking} from '../api/types';
import type {Messages} from '../i18n/catalog';
import {addDays, formatLongDate, unbrokenRange} from '../lib/dates';

// A change the admin makes to a resource that can cancel bookings.
export type ChangeKind = 'schedule' | 'closing';

// The bookings a confirmation names, before it says how many more.
export const CANCELS_NAMED = 6;

// The days a change can start on, as the server allows them: new times
// from tomorrow, so a slot under way today never overlaps one of them, and
// a closing from today. New times are planned ahead, so they start on the
// first day they cancel nothing; a closing is made when something is
// wrong, so it starts today, and those who booked are told.
export function changeDays(
  kind: ChangeKind,
  today: string,
  freeFrom: string,
): {first: string; free: string; chosen: string} {
  const first = kind === 'schedule' ? addDays(today, 1) : today;
  const free = freeFrom > first ? freeFrom : first;

  return {first, free, chosen: kind === 'schedule' ? free : first};
}

// Whether the change asks why: a closing always, since the closed resource
// shows it to everyone; new times only from a day they can cancel
// bookings, so a message typed for an earlier day is not sent with them.
export function asksReason(kind: ChangeKind, day: string, free: string) {
  return kind === 'closing' || day < free;
}

// The bookings a change cancels, each with its apartment and time, then
// what the apartments are told.
export function cancelsMessage(
  cancels: CancelledBooking[],
  t: Messages,
): string {
  const named = cancels
    .slice(0, CANCELS_NAMED)
    .map((booking) =>
      t.admin.change.cancelLine(
        booking.apartment,
        `${formatLongDate(booking.date, t)} ${unbrokenRange(booking.start, booking.end)}`,
      ),
    );
  const more = cancels.length - named.length;

  return [
    [...named, ...(more > 0 ? [t.admin.change.cancelMore(more)] : [])].join(
      '\n',
    ),
    t.admin.change.told(new Set(cancels.map(({apartment}) => apartment)).size),
  ].join('\n\n');
}
