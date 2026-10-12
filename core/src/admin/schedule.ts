import type {AdminKind, SlotInput} from '../api/types';
import type {Messages} from '../i18n/catalog';
import {unbrokenRange} from '../lib/dates';

export function slotsText(slots: SlotInput[]): string {
  return slots.map((slot) => unbrokenRange(slot.start, slot.end)).join(', ');
}

export function limitText(kind: AdminKind, t: Messages): string {
  return kind.maxActive === 1
    ? t.rules.oneBooking
    : t.rules.upToBookings(kind.maxActive);
}

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// What the admin can fix before the server is asked. Overlaps are left to
// the server, which knows the schedule the change follows.
export function slotsProblem(slots: SlotInput[], t: Messages): string | null {
  if (slots.length === 0) {
    return t.admin.schedule.noSlots;
  }

  if (slots.some((slot) => !TIME.test(slot.start) || !TIME.test(slot.end))) {
    return t.admin.schedule.timeFormat;
  }

  if (
    slots.some(
      (slot) =>
        slot.endOffsetDays === 0 &&
        minutesOf(slot.end) <= minutesOf(slot.start),
    )
  ) {
    return t.admin.schedule.endsBeforeStart;
  }

  return null;
}

function timeOf(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, '0');
  return `${hours}:${String(wrapped % 60).padStart(2, '0')}`;
}

// The next slot starts where the last one ended and lasts as long, which
// is how most schedules are laid out.
export function nextSlot(slots: SlotInput[]): SlotInput {
  const last = slots.at(-1);

  if (!last) {
    return {start: '08:00', end: '11:00', endOffsetDays: 0};
  }

  const start = minutesOf(last.end);
  const length =
    minutesOf(last.end) + last.endOffsetDays * 1440 - minutesOf(last.start);
  const end = start + length;

  return {
    start: timeOf(start),
    end: timeOf(end),
    endOffsetDays: end >= 1440 ? 1 : 0,
  };
}
