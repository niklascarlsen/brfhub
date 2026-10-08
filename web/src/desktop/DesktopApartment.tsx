import {api, unwrap} from '@/api/client';
import type {components} from '@/generated/api';
import {Account} from '@/components/Account';
import {ChevronBackIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useConfig} from '@/config';
import {SHELL} from '@/desktop/layout';
import {PageHeader} from '@/desktop/PageHeader';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {daysBetween, timeRange} from '@/lib/dates';
import {linkProps, type Route} from '@/lib/route';

type Kind = components['schemas']['BookingRules']['kinds'][number];

const listFormat = new Intl.ListFormat('sv', {type: 'conjunction'});

function fetchRules() {
  return unwrap(api.GET('/booking-rules'));
}

function timesOf(slots: Kind['resources'][number]['slots']): string {
  return slots.map((slot) => timeRange(slot.start, slot.end)).join(', ');
}

function limitOf(kind: Kind): string {
  if (kind.maxActive === 1) {
    return kind.resources.length > 1
      ? 'En bokning åt gången, för alla tillsammans'
      : 'En bokning åt gången';
  }

  return `Upp till ${kind.maxActive} bokningar åt gången`;
}

function KindRules({kind}: {kind: Kind}) {
  const times = kind.resources.map((resource) => timesOf(resource.slots));
  const sharedTimes = times.every((item) => item === times[0]);

  return (
    <div className='flex flex-col gap-2 rounded-2xl bg-theme-bg p-4'>
      <h3 className='text-[15px] font-semibold tracking-tight text-theme-ink'>
        {listFormat.format(kind.resources.map((resource) => resource.name))}
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
      <p className='text-xs leading-5 text-theme-muted'>{limitOf(kind)}</p>
    </div>
  );
}

function BookingRules() {
  const {window: bookingWindow} = useConfig();
  const daysAhead =
    daysBetween(bookingWindow.today, bookingWindow.to).length - 1;
  const {data: rules, error, reload} = useFocusLoad(fetchRules);
  const showSkeleton = useSlowLoad(rules === null && error === null);

  let body = null;
  if (rules) {
    body = (
      <div className='grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3'>
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
        <div className='grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3'>
          {Array.from({length: 4}, (_, index) => (
            <div
              key={index}
              className='flex h-28 flex-col gap-3 rounded-2xl bg-theme-bg p-4'
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
    <section
      aria-labelledby='rules-heading'
      className='flex flex-col gap-5 rounded-[22px] border border-theme-line bg-theme-surface px-7.5 py-7'
    >
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2
          id='rules-heading'
          className='text-[22px] font-semibold tracking-tight text-theme-ink'
        >
          Regler
        </h2>
        <span className='text-[13px] text-theme-muted'>
          Bokningsbart {daysAhead} dagar framåt
        </span>
      </div>
      {body}
    </section>
  );
}

export function DesktopApartment({
  onNavigate,
}: {
  onNavigate: (route: Route) => void;
}) {
  const {apartment, organizationName} = useConfig();

  return (
    <>
      <PageHeader eyebrow={organizationName} title={`Lägenhet ${apartment}`}>
        <a
          {...linkProps('boka', onNavigate)}
          className='flex h-11 items-center gap-2 rounded-full bg-theme-ink pr-5 pl-4 text-sm font-semibold text-theme-surface transition-opacity hover:opacity-90'
        >
          <ChevronBackIcon size={16} />
          Till bokningen
        </a>
      </PageHeader>
      {/* Account keeps its own bottom margin from the mobile screen. */}
      <div className={`${SHELL} flex flex-col pt-7 pb-12`}>
        <div className='max-w-xl'>
          <Account />
        </div>
        <BookingRules />
      </div>
    </>
  );
}
