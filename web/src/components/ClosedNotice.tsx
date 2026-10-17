import type {Resource} from '@booking/core/api/types';
import {closedNotice} from '@booking/core/booking/closing';

import {LockClosedIcon} from '@/components/icons';
import {useMessages} from '@/i18n/LocaleProvider';

// What a closed resource shows in place of its slots: that it cannot be
// booked, and what the admin says about it.
export function ClosedNotice({resource}: {resource: Resource}) {
  const t = useMessages();
  const {title, message} = closedNotice(resource, t);

  return (
    <div className='flex gap-3 rounded-card border border-theme-line bg-theme-sunk px-4.5 py-4'>
      <LockClosedIcon size={16} className='mt-0.5 shrink-0 text-theme-muted' />
      <div className='flex min-w-0 flex-col gap-1'>
        <p className='text-sm font-semibold text-theme-ink'>{title}</p>
        <p className='text-sm leading-5 whitespace-pre-line text-theme-muted'>
          {message}
        </p>
      </div>
    </div>
  );
}
