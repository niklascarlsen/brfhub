import type {ReactNode} from 'react';

import {ChevronForwardIcon} from '@/components/icons';

type ActionRowProps = {
  label: string;
  // A line on what is there now, under the label.
  description?: string;
  // Something that wants the admin's attention, beside the label.
  badge?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
};

// A fact on a detail page, its name to the left and its value to the right.
export function DetailRow({label, value}: {label: string; value: string}) {
  return (
    <div className='flex items-baseline justify-between gap-4 py-2.5'>
      <span className='shrink-0 text-[13px] text-theme-muted'>{label}</span>
      <span className='min-w-0 truncate text-right text-sm text-theme-ink'>
        {value}
      </span>
    </div>
  );
}

// A row in a list of steps down: what it opens, a line on what is there,
// and a chevron.
export function ActionRow({
  label,
  description,
  badge,
  disabled = false,
  onPress,
}: ActionRowProps) {
  return (
    <button
      type='button'
      onClick={onPress}
      disabled={disabled}
      className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
    >
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {label}
        </span>
        {description ? (
          <span className='line-clamp-2 text-[13px] leading-5 text-theme-muted'>
            {description}
          </span>
        ) : null}
      </span>
      {badge}
      <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
    </button>
  );
}

// A count of what needs doing, such as admins without two-step.
export function Badge({children}: {children: string}) {
  return (
    <span className='shrink-0 rounded-full bg-theme-danger/10 px-2 py-0.5 text-xs font-semibold text-theme-danger'>
      {children}
    </span>
  );
}
