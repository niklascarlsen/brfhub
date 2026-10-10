// The admin's buttons, kept in one place so every screen looks the same.
// The labels take text-sm's size without its line height: on Android a
// fixed line height on a one-line label cut "Add apartment" to "Add".
export const PRIMARY_BUTTON =
  'h-12 flex-row items-center justify-center gap-2 rounded-full bg-theme-ink px-5 active:opacity-70 disabled:opacity-50';
export const PRIMARY_LABEL =
  'text-[0.875rem] font-semibold tracking-tight text-theme-surface';

// A save with nothing to save yet: plainly off, not a faded primary.
export const INACTIVE_BUTTON =
  'h-12 flex-row items-center justify-center gap-2 rounded-full bg-theme-track px-5';
export const INACTIVE_LABEL =
  'text-[0.875rem] font-semibold tracking-tight text-theme-faint';

export const SECONDARY_BUTTON =
  'h-12 flex-row items-center justify-center gap-2 rounded-full border border-theme-edge bg-theme-surface px-5 active:opacity-70 disabled:opacity-50';
export const SECONDARY_LABEL =
  'text-[0.875rem] font-semibold tracking-tight text-theme-ink';

export const SECTION_LABEL =
  'mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted';

export const CARD =
  'rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4';
