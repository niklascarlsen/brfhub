import {sv} from '@/i18n/sv';

// The app was written in Swedish, so its messages give the shape every
// other language fills in.
export type Messages = typeof sv;

export const CATALOGS = {sv} satisfies Record<string, Messages>;
