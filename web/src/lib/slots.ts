import type {Slot} from '@/api/client';
import type {Messages} from '@/i18n/catalog';
import {exhaustive} from '@/lib/exhaustive';

type Appearance = {
  surface: string;
  time: string;
  label: string;
  tone: string;
  mark: 'dot' | 'lock' | null;
  chevron: boolean;
};

export function slotAppearance(slot: Slot, t: Messages): Appearance {
  switch (slot.status) {
    case 'mine':
      return {
        surface: 'border border-transparent bg-theme-mist',
        time: 'text-theme-ink',
        label: t.slots.mine,
        tone: 'font-semibold text-theme-accent',
        mark: 'dot',
        chevron: false,
      };
    case 'available':
      return slot.subscriptionId
        ? {
            surface: 'border border-theme-accent bg-theme-surface',
            time: 'text-theme-ink',
            label: t.slots.freeNow,
            tone: 'font-semibold text-theme-accent',
            mark: null,
            chevron: true,
          }
        : {
            surface: 'border border-theme-line bg-theme-surface',
            time: 'text-theme-ink',
            label: t.slots.free,
            tone: 'font-medium text-theme-muted',
            mark: null,
            chevron: true,
          };
    case 'walkin':
      return {
        surface: 'border border-transparent bg-theme-sunk',
        time: 'text-theme-faint',
        label: t.slots.dropIn,
        tone: 'font-medium text-theme-faint',
        mark: 'lock',
        chevron: false,
      };
    case 'booked':
      return {
        surface: 'border border-transparent bg-theme-sunk',
        time: 'text-theme-faint',
        label: slot.subscriptionId ? t.slots.queued : t.slots.taken,
        tone: slot.subscriptionId
          ? 'font-medium text-theme-accent'
          : 'font-medium text-theme-faint',
        mark: slot.started ? 'lock' : null,
        chevron: false,
      };
    default:
      return exhaustive(slot);
  }
}

export function isLocked(slot: Slot): boolean {
  return slot.status === 'walkin' || (slot.status === 'booked' && slot.started);
}
