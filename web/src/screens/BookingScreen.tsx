import type {BookingWindow, Resource} from '@booking/core/api/types';
import {formatDayHeading} from '@booking/core/lib/dates';

import {api, unwrap} from '@/api/client';
import {AnnouncementBanner} from '@/components/Announcements';
import {BookingHeader} from '@/components/BookingHeader';
import {ClosedNotice} from '@/components/ClosedNotice';
import {SlotList} from '@/components/SlotList';
import {Tag} from '@/components/Tag';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

function fetchDay(isoDate: string, resourceId: string) {
  return unwrap(
    api.GET('/slots', {params: {query: {date: isoDate, resourceId}}}),
  );
}

type BookingScreenProps = {
  bookingWindow: BookingWindow;
  resources: Resource[];
  resource: Resource;
  onSelectResource: (id: string) => void;
  date: string;
  onSelectDate: (isoDate: string) => void;
};

export function BookingScreen({
  bookingWindow,
  resources,
  resource,
  onSelectResource,
  date,
  onSelectDate,
}: BookingScreenProps) {
  const t = useMessages();
  const {
    data: day,
    error,
    reload,
  } = useFocusLoad(() => fetchDay(date, resource.id), `${date}:${resource.id}`);

  const {confirm} = useBookingActions(reload);

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='shrink-0 bg-theme-bg'>
        <BookingHeader
          resources={resources}
          resource={resource}
          onSelectResource={onSelectResource}
          bookingWindow={bookingWindow}
          isoDate={date}
          onSelectDate={onSelectDate}
        />
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth pb-[var(--tab-bar-clearance,0px)] [-webkit-overflow-scrolling:touch]'>
        {/* Fades the page softly under the fixed pickers, so what scrolls
            up does not end on a hard edge. It takes no room and is shallower
            than the page's top padding, so nothing at rest is faded. The
            app does this with TopFade. */}
        <div
          aria-hidden
          className='pointer-events-none sticky top-0 z-10 -mb-2 h-2 bg-linear-to-b from-theme-fade-veil to-theme-fade-clear'
        />
        <div className='flex min-h-full w-full flex-col px-5 pb-8 pt-2'>
          <AnnouncementBanner className='mt-2 mb-4' />
          <h1 className='text-[27px] font-semibold tracking-tight text-theme-ink'>
            {formatDayHeading(date, t)}
          </h1>
          {resource.tags.length > 0 ? (
            <div className='my-1 flex flex-wrap gap-1.5'>
              {resource.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          ) : null}
          <div className='mt-4 pb-4 flex grow flex-col'>
            {resource.closed ? (
              <ClosedNotice resource={resource} />
            ) : (
              <SlotList
                day={day}
                resource={resource}
                error={error}
                onRetry={reload}
                onSelect={confirm}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
