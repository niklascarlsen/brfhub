import {api, unwrap} from '@/api/client';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useConfig} from '@/config';
import type {components} from '@/generated/api';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {daysBetween, formatDayMonth, timeRange} from '@/lib/dates';

type Kind = components['schemas']['BookingRules']['kinds'][number];

function fetchRules() {
  return unwrap(api.GET('/booking-rules'));
}

// "A, B och C". Intl.ListFormat is missing on Hermes, so the app spells it
// out, and this stays the same.
function joinNames(names: string[]): string {
  if (names.length < 2) {
    return names.join('');
  }

  return `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;
}

// Word joiners around the dash keep a range on one line, so the list only
// wraps between ranges.
function unbroken(start: string, end: string): string {
  return timeRange(start, end).replace('–', '\u2060–\u2060');
}

function limitOf(kind: Kind): string {
  if (kind.maxActive === 1) {
    return kind.resources.length > 1
      ? 'En bokning åt gången, för alla tillsammans'
      : 'En bokning åt gången';
  }

  return `Upp till ${kind.maxActive} bokningar åt gången`;
}

// Changes the admin has set up ahead: new times from a day, or a closing.
// They lie past the booking window, so members can plan for them.
function upcomingOf(kind: Kind): {key: string; text: string}[] {
  const named = kind.resources.length > 1;

  return kind.resources.flatMap((resource) => {
    const lead = (sentence: string) =>
      named ? `${resource.name}: ${sentence.toLowerCase()}` : sentence;
    const changes = resource.changes.map((change) => ({
      key: `${resource.id}-${change.validFrom}`,
      text: lead(
        `Från ${formatDayMonth(change.validFrom)} ${change.slots
          .map((slot) => unbroken(slot.start, slot.end))
          .join(', ')}`,
      ),
    }));

    return resource.closesFrom
      ? [
          ...changes,
          {
            key: `${resource.id}-closes`,
            text: lead(`Stängs ${formatDayMonth(resource.closesFrom)}`),
          },
        ]
      : changes;
  });
}

function KindRules({kind}: {kind: Kind}) {
  const times = kind.resources.map((resource) =>
    resource.slots.map((slot) => unbroken(slot.start, slot.end)).join(', '),
  );
  const sharedTimes = times.every((item) => item === times[0]);

  return (
    <div className='flex flex-col gap-2 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-4'>
      <h3 className='text-[15px] font-semibold tracking-tight text-theme-ink'>
        {joinNames(kind.resources.map((resource) => resource.name))}
      </h3>
      {sharedTimes ? (
        <p className='text-[13px] leading-5 tabular-nums text-theme-ink'>
          {times[0]}
        </p>
      ) : (
        kind.resources.map((resource, index) => (
          <p
            key={resource.id}
            className='text-[13px] leading-5 tabular-nums text-theme-ink'
          >
            {resource.name}: {times[index]}
          </p>
        ))
      )}
      {upcomingOf(kind).map(({key, text}) => (
        <p
          key={key}
          className='text-[13px] leading-5 tabular-nums text-theme-accent'
        >
          {text}
        </p>
      ))}
      <p className='text-xs leading-5 text-theme-muted'>{limitOf(kind)}</p>
    </div>
  );
}

// The rules the server enforces, derived from the resources it books. The
// list layout differs between the phone and the desktop.
export function BookingRules({listClassName}: {listClassName: string}) {
  const {window: bookingWindow} = useConfig();
  const {data: rules, error, reload} = useFocusLoad(fetchRules);
  const showSkeleton = useSlowLoad(rules === null && error === null);
  const daysAhead =
    daysBetween(bookingWindow.today, bookingWindow.to).length - 1;

  let body = null;
  if (rules) {
    body = (
      <div className={listClassName}>
        {rules.kinds.map((kind) => (
          <KindRules key={kind.id} kind={kind} />
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel='Försök igen' onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <div className={listClassName}>
          {Array.from({length: 3}, (_, index) => (
            <div
              key={index}
              className='flex h-24 flex-col gap-3 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-4'
            >
              <SkeletonBar className='h-4 w-32' />
              <SkeletonBar className='h-3 w-48' />
            </div>
          ))}
        </div>
      </Skeleton>
    );
  }

  return (
    <section aria-labelledby='rules-heading'>
      <div className='mb-2.5 ml-0.5 flex items-baseline justify-between gap-3'>
        <h2
          id='rules-heading'
          className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
        >
          Regler
        </h2>
        <span className='text-xs text-theme-muted'>
          Bokningsbart {daysAhead} dagar framåt
        </span>
      </div>
      {body}
    </section>
  );
}
