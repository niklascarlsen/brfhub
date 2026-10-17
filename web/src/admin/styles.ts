// The admin's buttons, kept in one place so every screen looks the same.
export const PRIMARY_BUTTON =
  'flex h-12 items-center justify-center gap-2 rounded-full bg-theme-ink px-5 text-sm font-semibold tracking-tight text-theme-surface transition-opacity hover:opacity-90 active:opacity-70 disabled:opacity-50';

// A save with nothing to save yet: plainly off, not a faded primary.
export const INACTIVE_BUTTON =
  'flex h-12 cursor-default items-center justify-center gap-2 rounded-full bg-theme-track px-5 text-sm font-semibold tracking-tight text-theme-faint';

export const SECONDARY_BUTTON =
  'flex h-12 items-center justify-center gap-2 rounded-full border border-theme-edge bg-theme-surface px-5 text-sm font-semibold tracking-tight text-theme-ink transition-colors hover:bg-theme-sunk active:opacity-70 disabled:opacity-50';

export const SECTION_LABEL =
  'mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted';

export const CARD =
  'rounded-card border border-theme-line bg-theme-surface px-4.5 py-4';

// A card of rows divided by lines. It clips the rows to its corners, so
// `list-card` in index.css draws a row's focus ring inside the row.
export const LIST =
  'list-card flex flex-col divide-y divide-theme-line overflow-hidden rounded-card border border-theme-line bg-theme-surface';
