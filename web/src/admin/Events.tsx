import {describeEvent, formatEventTime} from '@booking/core/admin/events';

import {Notice} from '@/components/Notice';
import {adminLoad} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

// What the admins have done, newest first.
export function Events() {
  const t = useMessages();
  const {data: events, error, reload} = useFocusLoad(adminLoad.events);

  if (error && !events) {
    return (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  }

  if (!events) {
    return null;
  }

  if (events.length === 0) {
    return <p className='text-sm text-theme-muted'>{t.admin.events.none}</p>;
  }

  return (
    <div className='flex flex-col gap-3'>
      <p className='text-[13px] leading-5 text-theme-muted'>
        {t.admin.events.note}
      </p>
      <ul className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
        {events.map((event) => (
          <li key={event.id} className='flex flex-col gap-0.5 px-4.5 py-3'>
            <span className='text-sm text-theme-ink'>
              {describeEvent(event, t)}
            </span>
            <span className='text-[13px] text-theme-muted'>
              {`${formatEventTime(event.at, t)} · ${event.actor}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
