import {closingRule} from '@booking/core/booking/closing';
import {ruleParagraphs} from '@booking/core/booking/rules';
import {useConfig} from '@booking/core/config/config';
import type {components} from '@booking/core/generated/api';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {joinNames, type Messages} from '@booking/core/i18n/catalog';
import {
  daysBetween,
  formatDayMonth,
  isOvernight,
  shortTimeRange,
  unbrokenRange,
} from '@booking/core/lib/dates';
import {Text, View} from 'react-native';

import {api, unwrap} from '@/api/client';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useMessages} from '@/i18n/LocaleProvider';
import {useFocusLoad} from '@/hooks/useFocusLoad';

type Kind = components['schemas']['BookingRules']['kinds'][number];
type Slot = Kind['resources'][number]['slots'][number];

function fetchRules() {
  return unwrap(api.GET('/booking-rules'));
}

// Only the first letter, so a month name keeps the case its language
// writes it in.
function lowerFirst(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function limitOf(kind: Kind, t: Messages): string {
  if (kind.maxActive === 1) {
    return kind.resources.length > 1
      ? t.rules.oneBookingShared
      : t.rules.oneBooking;
  }

  return t.rules.upToBookings(kind.maxActive);
}

// What the admin has changed: new times from a day ahead, and a closing,
// ahead or under way, with what the admin says about it.
function upcomingOf(kind: Kind, t: Messages): {key: string; text: string}[] {
  const named = kind.resources.length > 1;

  return kind.resources.flatMap((resource) => {
    const lead = (sentence: string) =>
      named ? `${resource.name}: ${lowerFirst(sentence)}` : sentence;
    const changes = resource.changes.map((change) => ({
      key: `${resource.id}-${change.validFrom}`,
      text: lead(
        t.rules.changesFrom(
          formatDayMonth(change.validFrom, t),
          change.slots
            .map((slot) => unbrokenRange(slot.start, slot.end))
            .join(', '),
        ),
      ),
    }));

    const closing = closingRule(resource, t);

    return closing
      ? [...changes, {key: `${resource.id}-closes`, text: lead(closing)}]
      : changes;
  });
}

// One badge per slot. A slot that ends the next day is dashed.
function SlotBadges({slots}: {slots: Slot[]}) {
  return (
    <View className='flex-row flex-wrap gap-1.5'>
      {slots.map((slot) => (
        <View
          key={slot.start}
          className={`rounded-full border px-2.5 py-0.5 ${
            isOvernight(slot.start, slot.end)
              ? 'border-dashed border-theme-edge bg-theme-surface'
              : 'border-theme-line bg-theme-sunk'
          }`}
        >
          <Text className='font-sans text-xs leading-5 text-theme-ink'>
            {shortTimeRange(slot.start, slot.end)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function timeKey(slot: Slot): string {
  return `${slot.start}-${slot.end}`;
}

function KindRules({kind}: {kind: Kind}) {
  const t = useMessages();
  const times = kind.resources.map((resource) =>
    resource.slots.map((slot) => timeKey(slot)).join(','),
  );
  const sharedTimes = times.every((item) => item === times[0]);

  return (
    <View className='gap-2.5 rounded-card border border-theme-line bg-theme-surface px-[18px] py-4'>
      <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
        {joinNames(
          kind.resources.map((resource) => resource.name),
          t,
        )}
      </Text>
      {sharedTimes ? (
        <SlotBadges slots={kind.resources[0]?.slots ?? []} />
      ) : (
        kind.resources.map((resource) => (
          <View key={resource.id} className='gap-1.5'>
            <Text className='font-sans text-xs text-theme-muted'>
              {resource.name}
            </Text>
            <SlotBadges slots={resource.slots} />
          </View>
        ))
      )}
      {upcomingOf(kind, t).map(({key, text}) => (
        <Text
          key={key}
          className='font-sans text-[13px] leading-5 text-theme-accent'
        >
          {text}
        </Text>
      ))}
      <Text className='font-sans text-xs leading-5 text-theme-muted'>
        {limitOf(kind, t)}
      </Text>
    </View>
  );
}

// The organization's own rules, numbered when the admin wrote more than
// one paragraph.
function HouseRules({text}: {text: string}) {
  const t = useMessages();
  const rules = ruleParagraphs(text);

  return (
    <View>
      <Text
        accessibilityRole='header'
        className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
      >
        {t.rules.heading}
      </Text>
      <View className='rounded-card border border-theme-line bg-theme-surface px-[18px] py-1'>
        {rules.length > 1 ? (
          rules.map((rule, index) => (
            <View
              key={index}
              className={`flex-row gap-2.5 py-3 ${index > 0 ? 'border-t border-theme-line' : ''}`}
            >
              <Text className='w-4 font-sans text-xs leading-5 text-theme-faint'>
                {index + 1}
              </Text>
              <Text className='min-w-0 flex-1 font-sans text-[13px] leading-5 text-theme-ink'>
                {rule}
              </Text>
            </View>
          ))
        ) : (
          <Text className='py-3 font-sans text-[13px] leading-5 text-theme-ink'>
            {rules[0]}
          </Text>
        )}
      </View>
    </View>
  );
}

// The organization's own rules, then the ones the server enforces, derived
// from the resources it books.
export function BookingRules() {
  const {window: bookingWindow} = useConfig();
  const t = useMessages();
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
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <View className='gap-2.5'>
          {Array.from({length: 3}, (_, index) => (
            <View
              key={index}
              className='h-24 gap-3 rounded-card border border-theme-line bg-theme-surface px-[18px] py-4'
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
    <View className='gap-[26px]'>
      {rules?.text ? <HouseRules text={rules.text} /> : null}
      <View>
        <View className='mb-2.5 ml-0.5 flex-row items-baseline justify-between gap-3'>
          <Text
            accessibilityRole='header'
            className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
          >
            {t.rules.timesHeading}
          </Text>
          <Text className='font-sans text-xs text-theme-muted'>
            {t.rules.bookableDaysAhead(daysAhead)}
          </Text>
        </View>
        {body}
      </View>
    </View>
  );
}
