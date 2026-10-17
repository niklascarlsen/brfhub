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
    <ul className='flex flex-wrap gap-1.5'>
      {slots.map((slot) => (
        <li
          key={slot.start}
          className={`rounded-full border px-2.5 py-0.5 text-xs leading-5 whitespace-nowrap tabular-nums text-theme-ink ${
            isOvernight(slot.start, slot.end)
              ? 'border-dashed border-theme-edge bg-theme-surface'
              : 'border-theme-line bg-theme-sunk'
          }`}
        >
          {shortTimeRange(slot.start, slot.end)}
        </li>
      ))}
    </ul>
  );
}

function KindRules({kind}: {kind: Kind}) {
  const t = useMessages();
  const times = kind.resources.map((resource) =>
    resource.slots.map((slot) => timeKey(slot)).join(','),
  );
  const sharedTimes = times.every((item) => item === times[0]);

  return (
    <div className='flex flex-col gap-2.5 rounded-card border border-theme-line bg-theme-surface px-4.5 py-4'>
      <h3 className='text-[15px] font-semibold tracking-tight text-theme-ink'>
        {joinNames(
          kind.resources.map((resource) => resource.name),
          t,
        )}
      </h3>
      {sharedTimes ? (
        <SlotBadges slots={kind.resources[0]?.slots ?? []} />
      ) : (
        kind.resources.map((resource) => (
          <div key={resource.id} className='flex flex-col gap-1.5'>
            <span className='text-xs text-theme-muted'>{resource.name}</span>
            <SlotBadges slots={resource.slots} />
          </div>
        ))
      )}
      {upcomingOf(kind, t).map(({key, text}) => (
        <p
          key={key}
          className='text-[13px] leading-5 tabular-nums text-theme-accent'
        >
          {text}
        </p>
      ))}
      <p className='text-xs leading-5 text-theme-muted'>{limitOf(kind, t)}</p>
    </div>
  );
}

function timeKey(slot: Slot): string {
  return `${slot.start}-${slot.end}`;
}

// The organization's own rules, numbered when the admin wrote more than
// one paragraph.
function HouseRules({text, className}: {text: string; className?: string}) {
  const t = useMessages();
  const rules = ruleParagraphs(text);

  return (
    <section aria-labelledby='house-rules-heading' className={className}>
      <h2
        id='house-rules-heading'
        className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
      >
        {t.rules.heading}
      </h2>
      <div className='rounded-card border border-theme-line bg-theme-surface px-4.5 py-1'>
        {rules.length > 1 ? (
          <ol className='divide-y divide-theme-line'>
            {rules.map((rule, index) => (
              <li key={index} className='flex gap-2.5 py-3'>
                <span className='w-4 shrink-0 text-xs leading-5 text-theme-faint tabular-nums'>
                  {index + 1}
                </span>
                <p className='min-w-0 text-[13px] leading-5 whitespace-pre-line wrap-break-word text-theme-ink'>
                  {rule}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className='py-3 text-[13px] leading-5 whitespace-pre-line wrap-break-word text-theme-ink'>
            {rules[0]}
          </p>
        )}
      </div>
    </section>
  );
}

// The organization's own rules, then the ones the server enforces, derived
// from the resources it books. The layout differs between the phone and the
// desktop.
export function BookingRules({
  listClassName,
  houseRulesClassName,
}: {
  listClassName: string;
  houseRulesClassName?: string;
}) {
  const {window: bookingWindow} = useConfig();
  const t = useMessages();
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
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <div className={listClassName}>
          {Array.from({length: 3}, (_, index) => (
            <div
              key={index}
              className='flex h-24 flex-col gap-3 rounded-card border border-theme-line bg-theme-surface px-4.5 py-4'
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
    <div className='flex flex-col gap-6.5'>
      {rules?.text ? (
        <HouseRules text={rules.text} className={houseRulesClassName} />
      ) : null}
      <section aria-labelledby='times-heading'>
        <div className='mb-2.5 ml-0.5 flex items-baseline justify-between gap-3'>
          <h2
            id='times-heading'
            className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
          >
            {t.rules.timesHeading}
          </h2>
          <span className='text-xs text-theme-muted'>
            {t.rules.bookableDaysAhead(daysAhead)}
          </span>
        </div>
        {body}
      </section>
    </div>
  );
}
