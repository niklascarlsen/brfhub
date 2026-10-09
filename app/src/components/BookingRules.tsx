import {Text, View} from 'react-native';

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

// "A, B och C". Intl.ListFormat is missing on Hermes, so it is spelled out.
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
    <View className='gap-2 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'>
      <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
        {joinNames(kind.resources.map((resource) => resource.name))}
      </Text>
      {sharedTimes ? (
        <Text className='font-sans text-[13px] leading-5 text-theme-ink'>
          {times[0]}
        </Text>
      ) : (
        kind.resources.map((resource, index) => (
          <Text
            key={resource.id}
            className='font-sans text-[13px] leading-5 text-theme-ink'
          >
            {resource.name}: {times[index]}
          </Text>
        ))
      )}
      {upcomingOf(kind).map(({key, text}) => (
        <Text
          key={key}
          className='font-sans text-[13px] leading-5 text-theme-accent'
        >
          {text}
        </Text>
      ))}
      <Text className='font-sans text-xs leading-5 text-theme-muted'>
        {limitOf(kind)}
      </Text>
    </View>
  );
}

// The rules the server enforces, derived from the resources it books.
export function BookingRules() {
  const {window: bookingWindow} = useConfig();
  const {data: rules, error, reload} = useFocusLoad(fetchRules);
  const showSkeleton = useSlowLoad(rules === null && error === null);
  const daysAhead =
    daysBetween(bookingWindow.today, bookingWindow.to).length - 1;

  let body = null;
  if (rules) {
    body = (
      <View className='gap-2.5'>
        {rules.kinds.map((kind) => (
          <KindRules key={kind.id} kind={kind} />
        ))}
      </View>
    );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel='Försök igen' onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <View className='gap-2.5'>
          {Array.from({length: 3}, (_, index) => (
            <View
              key={index}
              className='h-24 gap-3 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'
            >
              <SkeletonBar className='h-4 w-32' />
              <SkeletonBar className='h-3 w-48' />
            </View>
          ))}
        </View>
      </Skeleton>
    );
  }

  return (
    <View>
      <View className='mb-2.5 ml-0.5 flex-row items-baseline justify-between gap-3'>
        <Text
          accessibilityRole='header'
          className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
        >
          Regler
        </Text>
        <Text className='font-sans text-xs text-theme-muted'>
          Bokningsbart {daysAhead} dagar framåt
        </Text>
      </View>
      {body}
    </View>
  );
}
