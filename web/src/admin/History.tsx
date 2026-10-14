import {
  describeEvent,
  EVENT_AREAS,
  eventActor,
  eventArea,
  formatEventClock,
  groupEventsByDay,
  type EventArea,
} from '@booking/core/admin/events';
import type {AdminEvent} from '@booking/core/api/types';
import {useId, useState} from 'react';

import {SECTION_LABEL} from '@/admin/styles';
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
// first, narrowed to one part of the admin if asked.
export function History({events}: {events: AdminEvent[]}) {
  const t = useMessages();
  const [area, setArea] = useState<EventArea | null>(null);
  const filterId = useId();

  if (events.length === 0) {
    return <p className='text-sm text-theme-muted'>{t.admin.events.none}</p>;
  }

  const shown =
    area === null
      ? events
      : events.filter((event) => eventArea(event) === area);
  const days = groupEventsByDay(shown, t);

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
      {days.length === 0 ? (
        <p className='text-sm text-theme-muted'>{t.admin.events.noneIn}</p>
      ) : (
        days.map((day) => (
          <section key={day.day} aria-label={day.heading}>
            <h3 className={SECTION_LABEL}>{day.heading}</h3>
            <ul className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
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
    </div>
  );
}
