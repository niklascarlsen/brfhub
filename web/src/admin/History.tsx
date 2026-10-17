import {
  describeEvent,
  EVENT_AREAS,
  eventActor,
  formatEventClock,
  groupEventsByDay,
} from '@booking/core/admin/events';
import {useEventHistory} from '@booking/core/admin/useEventHistory';
import {errorMessage} from '@booking/core/api/errors';
import type {EventArea} from '@booking/core/api/types';
import {useId, useState} from 'react';

import {LIST, SECONDARY_BUTTON, SECTION_LABEL_TEXT} from '@/admin/styles';
import {Notice, NoticeBar} from '@/components/Notice';
import {adminLoad} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

function AreaChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type='button'
      aria-pressed={selected}
      onClick={onPress}
      className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
        selected
          ? 'border-theme-ink bg-theme-ink text-theme-surface'
          : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
      }`}
    >
      {label}
    </button>
  );
}

// What the admins have done in the last year, a day at a time, newest
// first, a page at a time, narrowed to one part of the admin if asked.
export function History() {
  const t = useMessages();
  const [area, setArea] = useState<EventArea | null>(null);
  const filterId = useId();
  const key = area ?? '';
  const newest = useFocusLoad(() => adminLoad.events(area), key);
  // Another area's list stays until this one's comes, so the chips and the
  // page stay where they are.
  const history = useEventHistory(newest.data, key, (after) =>
    adminLoad.events(area, after),
  );

  const {events} = history;
  if (events === null) {
    return newest.error ? (
      <Notice
        message={newest.error}
        actionLabel={t.common.retry}
        onAction={newest.reload}
      />
    ) : null;
  }

  if (events.length === 0 && history.shownKey === '') {
    return <p className='text-sm text-theme-muted'>{t.admin.events.none}</p>;
  }

  const days = groupEventsByDay(events, t);

  return (
    <div className='flex flex-col gap-5'>
      <p className='text-[13px] leading-5 text-theme-muted'>
        {t.admin.events.note}
      </p>
      <div
        role='group'
        aria-labelledby={filterId}
        // The phone scrolls the chips sideways, out to the screen's edge.
        className='-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0'
      >
        <span id={filterId} className='sr-only'>
          {t.admin.events.filter}
        </span>
        <AreaChip
          label={t.admin.events.all}
          selected={area === null}
          onPress={() => setArea(null)}
        />
        {EVENT_AREAS.map((item) => (
          <AreaChip
            key={item}
            label={t.admin.events.areas[item]}
            selected={area === item}
            onPress={() => setArea(item)}
          />
        ))}
      </div>
      {newest.error ? (
        // The bar's own margin is the list's gap here.
        <div className='-mb-4'>
          <NoticeBar
            message={newest.error}
            actionLabel={t.common.retry}
            onAction={newest.reload}
          />
        </div>
      ) : null}
      {/* Another area's list is not shown as this one's when it failed. */}
      {history.stale && newest.error ? null : days.length === 0 ? (
        <p className='text-sm text-theme-muted'>{t.admin.events.noneIn}</p>
      ) : (
        days.map((day) => (
          <section key={day.day} aria-label={day.heading}>
            {/* Sticks to the top while its day scrolls under it, over the
                rows and across the screen. */}
            <h3 className='sticky top-0 z-10 -mx-5 -mt-2 bg-theme-bg px-5 pt-2 pb-2.5 lg:mx-0 lg:px-0'>
              <span className={`block ${SECTION_LABEL_TEXT}`}>
                {day.heading}
              </span>
            </h3>
            <ul className={LIST}>
              {day.events.map((event) => (
                <li
                  key={event.id}
                  className='grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 px-4.5 py-3 lg:grid-cols-[3rem_minmax(0,1fr)_minmax(0,12rem)] lg:items-baseline'
                >
                  <span className='text-[13px] text-theme-muted tabular-nums'>
                    {formatEventClock(event.at, t)}
                  </span>
                  <span className='text-sm text-theme-ink'>
                    {describeEvent(event, t)}
                  </span>
                  <span className='col-start-2 truncate text-[13px] text-theme-muted lg:col-start-3 lg:text-right'>
                    {eventActor(event)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {history.olderError ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {errorMessage(history.olderError, t)}
        </p>
      ) : null}
      {history.hasOlder ? (
        <button
          type='button'
          onClick={history.showOlder}
          disabled={history.loadingOlder}
          className={`${SECONDARY_BUTTON} self-start`}
        >
          {t.admin.events.older}
        </button>
      ) : null}
    </div>
  );
}
