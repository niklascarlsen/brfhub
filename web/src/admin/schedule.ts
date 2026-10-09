import type {AdminKind, SlotInput} from '@/api/client';
import {timeRange} from '@/lib/dates';

export function slotsText(slots: SlotInput[]): string {
  return slots.map((slot) => timeRange(slot.start, slot.end)).join(', ');
}

export function limitText(kind: AdminKind): string {
  return kind.maxActive === 1
    ? 'En bokning åt gången'
    : `Upp till ${kind.maxActive} bokningar åt gången`;
}

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
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
