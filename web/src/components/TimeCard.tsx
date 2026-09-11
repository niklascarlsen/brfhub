import {SkeletonBar} from '@/components/Skeleton';
import {formatLongDate, timeRange} from '@/lib/dates';

type Badge = {label: string; tone: 'accent' | 'muted'};

export type TimeCardLayout = 'card' | 'row';

type TimeCardProps = {
  date: string;
  start: string;
  end: string;
  resourceName?: string;
  badge: Badge | null;
  layout?: TimeCardLayout;
  actionLabel?: string;
  actionTone?: 'solid' | 'outline';
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const SHELL =
  'flex items-center rounded-2xl border border-theme-line bg-theme-surface';

function BadgeChip({badge}: {badge: Badge}) {
  return (
    <span
      className={`rounded-full px-2.25 py-1 text-[10px] font-bold tracking-[1px] uppercase ${
        badge.tone === 'accent'
          ? 'bg-theme-mist text-theme-accent'
          : 'bg-theme-sunk text-theme-muted'
      }`}
    >
      {badge.label}
    </span>
  );
}

function Actions({
  actionLabel,
  actionTone,
  onAction,
  secondaryLabel,
  onSecondary,
}: Pick<
  TimeCardProps,
  'actionLabel' | 'actionTone' | 'onAction' | 'secondaryLabel' | 'onSecondary'
>) {
  if (!actionLabel || !onAction) {
    return null;
  }

  const solid = actionTone === 'solid';

  return (
    <div className='flex shrink-0 flex-col items-end gap-1.5'>
      <button
        type='button'
        onClick={onAction}
        className={`h-11 rounded-full px-5 text-sm font-semibold tracking-tight active:opacity-70 ${
          solid
            ? 'bg-theme-ink text-theme-surface hover:opacity-90'
            : 'border border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
        }`}
      >
        {actionLabel}
      </button>
      {secondaryLabel && onSecondary ? (
        <button
          type='button'
          onClick={onSecondary}
          className='h-6.5 rounded-lg px-1 text-[13px] font-medium text-theme-muted active:opacity-60'
        >
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  );
}

export function TimeCard({
  date,
  start,
  end,
  resourceName,
  badge,
  layout = 'card',
  ...actions
}: TimeCardProps) {
  if (layout === 'row') {
    return (
      <div className={`${SHELL} gap-6 px-6 py-5`}>
        <div className='flex shrink-0 items-center self-stretch border-r border-theme-line pr-6'>
          <span className='text-[22px] font-semibold tracking-tight tabular-nums text-theme-ink'>
            {timeRange(start, end)}
          </span>
        </div>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            {resourceName ? (
              <span className='text-[17px] font-semibold tracking-tight text-theme-ink'>
                {resourceName}
              </span>
            ) : null}
            {badge ? <BadgeChip badge={badge} /> : null}
          </div>
          <span className='text-[13px] font-medium text-theme-muted'>
            {formatLongDate(date)}
          </span>
        </div>
        <Actions {...actions} />
      </div>
    );
  }

  return (
    <div className={`${SHELL} gap-3.5 px-4.5 py-4`}>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='flex items-center gap-2'>
          {resourceName ? (
            <span className='text-sm font-semibold text-theme-muted'>
              {resourceName}
            </span>
          ) : null}
          {badge ? <BadgeChip badge={badge} /> : null}
        </div>
        <span className='text-[22px] font-semibold tracking-tight tabular-nums text-theme-ink'>
          {timeRange(start, end)}
        </span>
        <span className='text-[13px] font-medium text-theme-muted'>
          {formatLongDate(date)}
        </span>
      </div>
      <Actions {...actions} />
    </div>
  );
}

export function TimeCardSkeleton({layout = 'card'}: {layout?: TimeCardLayout}) {
  if (layout === 'row') {
    return (
      <div className={`${SHELL} gap-6 px-6 py-5`}>
        <div className='flex w-45 shrink-0 items-center self-stretch border-r border-theme-line pr-6'>
          <SkeletonBar className='h-6.5 w-35' />
        </div>
        <div className='flex min-w-0 flex-1 flex-col gap-2'>
          <SkeletonBar className='h-5 w-33' />
          <SkeletonBar className='h-4 w-37' />
        </div>
        <div className='h-11 w-23.5 rounded-full bg-theme-sunk' />
      </div>
    );
  }

  return (
    <div className={`${SHELL} gap-3.5 px-4.5 py-4`}>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <SkeletonBar className='h-4 w-23' />
        <SkeletonBar className='h-6.5 w-38' />
        <SkeletonBar className='h-4 w-31' />
      </div>
      <div className='h-11 w-23.5 rounded-full bg-theme-sunk' />
    </div>
  );
}
