import type {SlotLook, SlotOffer, SlotTone} from '@booking/core/booking/offer';

type Appearance = {
  surface: string;
  time: string;
  tone: string;
  chevron: boolean;
};

const LOOKS: Record<SlotLook, Omit<Appearance, 'tone'>> = {
  mine: {
    surface: 'border border-transparent bg-theme-mist',
    time: 'text-theme-ink',
    chevron: false,
  },
  freeNow: {
    surface: 'border border-theme-accent bg-theme-surface',
    time: 'text-theme-ink',
    chevron: true,
  },
  free: {
    surface: 'border border-theme-line bg-theme-surface',
    time: 'text-theme-ink',
    chevron: true,
  },
  closed: {
    surface: 'border border-transparent bg-theme-sunk',
    time: 'text-theme-faint',
    chevron: false,
  },
};

const TONES: Record<SlotTone, string> = {
  strong: 'font-semibold text-theme-accent',
  accent: 'font-medium text-theme-accent',
  muted: 'font-medium text-theme-muted',
  faint: 'font-medium text-theme-faint',
};

// The classes for what a time offers, which core decides.
export function slotAppearance({look, tone}: SlotOffer): Appearance {
  return {...LOOKS[look], tone: TONES[tone]};
}
