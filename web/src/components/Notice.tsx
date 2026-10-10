import {AlertCircleIcon} from '@/components/icons';

type NoticeProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Notice({title, message, actionLabel, onAction}: NoticeProps) {
  return (
    <div className='flex grow flex-col items-center justify-center lg:items-start lg:justify-start px-8 lg:px-0 py-12 lg:py-0'>
      {title ? (
        <p className='mb-2 text-center text-xl md:hidden font-semibold text-theme-ink'>
          {title}
        </p>
      ) : null}
      <p className='text-center lg:text-start max-w-80 text-sm leading-5 text-theme-muted'>
        {message}
      </p>
      {actionLabel && onAction ? (
        <button
          type='button'
          onClick={onAction}
          className='mt-3 text-base font-semibold text-theme-accent transition-opacity hover:opacity-70 active:opacity-60'
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

type NoticeBarProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function NoticeBar({message, actionLabel, onAction}: NoticeBarProps) {
  return (
    <div className='mb-4 flex items-center gap-2.5 rounded-xl border border-theme-edge bg-theme-sunk py-2.5 pl-3.5 pr-2.5'>
      <AlertCircleIcon size={18} className='text-theme-ink' />
      <p className='min-w-0 flex-1 text-[13px] font-medium leading-4.5 text-theme-ink'>
        {message}
      </p>
      {actionLabel && onAction ? (
        <button
          type='button'
          onClick={onAction}
          className='h-8 shrink-0 rounded-full border border-theme-edge bg-theme-surface px-3.5 text-[13px] font-semibold text-theme-ink transition-colors hover:bg-theme-sunk active:opacity-70'
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
