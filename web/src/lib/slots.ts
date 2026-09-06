import type {Slot} from '@/api/client';
import {exhaustive} from '@/lib/exhaustive';

type Appearance = {
  surface: string;
  time: string;
  label: string;
  tone: string;
  mark: 'dot' | 'lock' | null;
  chevron: boolean;
};

export function slotAppearance(slot: Slot): Appearance {
  switch (slot.status) {
    case 'mine':
      return {
        surface: 'border border-transparent bg-theme-mist',
        time: 'text-theme-ink',
        label: 'Din tid',
        tone: 'font-semibold text-theme-accent',
        mark: 'dot',
        chevron: false,
      };
    case 'available':
      return slot.subscriptionId
        ? {
            surface: 'border border-theme-accent bg-theme-surface',
            time: 'text-theme-ink',
            label: 'Ledig nu',
            tone: 'font-semibold text-theme-accent',
            mark: null,
            chevron: true,
          }
        : {
            surface: 'border border-theme-line bg-theme-surface',
            time: 'text-theme-ink',
            label: 'Ledig',
            tone: 'font-medium text-theme-muted',
            mark: null,
            chevron: true,
          };
    case 'walkin':
      return {
        surface: 'border border-transparent bg-theme-sunk',
        time: 'text-theme-faint',
        label: 'Drop-in',
        tone: 'font-medium text-theme-faint',
        mark: 'lock',
        chevron: false,
      };
    case 'booked':
      return {
        surface: 'border border-transparent bg-theme-sunk',
        time: 'text-theme-faint',
        label: slot.subscriptionId ? 'I kö' : 'Upptagen',
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
