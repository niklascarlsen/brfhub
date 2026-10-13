import type {
  BookingWindow,
  Held,
  Resource,
  Slot,
} from '@booking/core/api/types';
import {slotOffer, type BookingAction} from '@booking/core/booking/offer';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {timeRange} from '@booking/core/lib/dates';
import {useRef} from 'react';

import {
  ChevronBackIcon,
  ChevronForwardIcon,
  LockClosedIcon,
} from '@/components/icons';
import {Notice, NoticeBar} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {Tag} from '@/components/Tag';
import {addDays, formatHeadingDate, relativeDay} from '@/desktop/weeks';
import {useMessages} from '@/i18n/LocaleProvider';
import {slotAppearance} from '@/lib/slots';

export type ResourceDay = {
  resource: Resource;
  slots: Slot[];
  held: Held;
};

type DayPanelProps = {
  isoDate: string;
  bookingWindow: BookingWindow;
  // Null until the schedule has loaded.
  day: ResourceDay[] | null;
  error: string | null;
  onRetry: () => void;
  onSelectDate: (isoDate: string) => void;
  onSelect: (action: BookingAction) => void;
};

function DayNavButton({
  label,
  disabled,
  onClick,
  ref,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  ref: React.Ref<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <button
      type='button'
      ref={ref}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className='flex h-10 w-10 items-center justify-center rounded-full border border-theme-edge bg-theme-surface text-theme-ink transition-colors hover:bg-theme-sunk disabled:cursor-default disabled:opacity-35 disabled:hover:bg-theme-surface'
    >
      {children}
    </button>
  );
}

function SlotChip({
  slot,
  entry,
  onSelect,
}: {
  slot: Slot;
  entry: ResourceDay;
  onSelect: (action: BookingAction) => void;
}) {
  const t = useMessages();
  const offer = slotOffer(slot, entry.resource, entry.held, t);
  const {locked, label, mark, action} = offer;
  const {surface, tone} = slotAppearance(offer);

  return (
    <button
      type='button'
      onClick={() => {
        if (action) {
          onSelect(action);
        }
      }}
      disabled={locked}
      className={`flex min-h-14.5 min-w-30 flex-col items-start justify-center gap-0.5 rounded-xl px-3.5 py-2 text-left ${surface} ${
        locked
          ? ''
          : 'transition-colors hover:border-theme-accent active:opacity-80'
      }`}
    >
      <span className='text-sm font-semibold tabular-nums text-theme-ink'>
        {timeRange(slot.start, slot.end)}
      </span>
      <span className='flex items-center gap-1.5'>
        {mark === 'dot' ? (
          <span className='h-1.5 w-1.5 rounded-full bg-theme-accent' />
        ) : null}
        {mark === 'lock' ? (
          <LockClosedIcon size={11} className='text-theme-faint' />
        ) : null}
        <span className={`text-xs ${tone}`}>{label}</span>
      </span>
    </button>
  );
}

function DayPanelSkeleton() {
  return (
    <Skeleton>
      <div className='flex flex-col gap-4'>
        {Array.from({length: 3}, (_, index) => (
          <div
            key={index}
            className='flex flex-col gap-3 rounded-[18px] border border-theme-line bg-theme-surface px-4.5 py-4'
          >
            <SkeletonBar className='h-4 w-32' />
            <div className='flex gap-2'>
              {Array.from({length: 4}, (_, chip) => (
                <div
                  key={chip}
                  className='h-14.5 w-30 rounded-xl bg-theme-sunk'
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function DayPanel({
  isoDate,
  bookingWindow,
  day,
  error,
  onRetry,
  onSelectDate,
  onSelect,
}: DayPanelProps) {
  const previousButton = useRef<HTMLButtonElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const showSkeleton = useSlowLoad(day === null && error === null);
  const t = useMessages();

  // Stepping onto the first or last day disables the button under the
  // cursor. Hand focus to the one that stays enabled.
  function step(days: number) {
    const target = addDays(isoDate, days);

    if (target === bookingWindow.from) {
      nextButton.current?.focus();
    } else if (target === bookingWindow.to) {
      previousButton.current?.focus();
    }

    onSelectDate(target);
  }

  const free = day
    ?.flatMap((entry) => entry.slots)
    .filter((slot) => slot.status === 'available').length;

  let freeLabel = null;
  if (free !== undefined) {
    freeLabel = t.booking.freeSlots(free);
  }

  const eyebrow = [relativeDay(isoDate, bookingWindow.today, t), freeLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className='flex min-w-0 flex-1 flex-col gap-4'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <span className='h-5 text-[13px] text-theme-muted'>{eyebrow}</span>
          <h2 className='text-[26px] font-semibold tracking-tight text-theme-ink'>
            {formatHeadingDate(isoDate, t)}
          </h2>
        </div>
        <div className='flex shrink-0 gap-2'>
          <DayNavButton
            label={t.booking.previousDay}
            disabled={isoDate <= bookingWindow.from}
            onClick={() => step(-1)}
            ref={previousButton}
          >
            <ChevronBackIcon size={16} />
          </DayNavButton>
          <DayNavButton
            label={t.booking.nextDay}
            disabled={isoDate >= bookingWindow.to}
            onClick={() => step(1)}
            ref={nextButton}
          >
            <ChevronForwardIcon size={16} />
          </DayNavButton>
        </div>
      </div>
      {day === null ? (
        error ? (
          <Notice
            message={error}
            actionLabel={t.common.retry}
            onAction={onRetry}
          />
        ) : showSkeleton ? (
          <DayPanelSkeleton />
        ) : null
      ) : (
        <>
          {error ? (
            <NoticeBar
              message={error}
              actionLabel={t.common.retry}
              onAction={onRetry}
            />
          ) : null}
          {day.map((entry) => (
            <section
              key={entry.resource.id}
              aria-label={entry.resource.name}
              className='flex flex-col gap-3 rounded-[18px] border border-theme-line bg-theme-surface px-4.5 py-4'
            >
              <div className='flex flex-wrap items-center gap-2.5'>
                <h3 className='text-base font-semibold tracking-tight text-theme-ink'>
                  {entry.resource.name}
                </h3>
                {entry.resource.tags.map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
              </div>
              {entry.slots.length === 0 ? (
                <p className='text-[13px] text-theme-muted'>
                  {t.booking.noSlotsLeft}
                </p>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {entry.slots.map((slot) => (
                    <SlotChip
                      key={slot.start}
                      slot={slot}
                      entry={entry}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </section>
  );
}
