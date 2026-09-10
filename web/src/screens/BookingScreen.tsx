import {api, unwrap, type BookingWindow, type Resource} from '@/api/client';
import {BookingHeader} from '@/components/BookingHeader';
import {SlotList} from '@/components/SlotList';
import {Tag} from '@/components/Tag';
import {useBookingActions} from '@/hooks/useBookingActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {formatLongDate} from '@/lib/dates';

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
  const {
    data: day,
    error,
    reload,
  } = useFocusLoad(() => fetchDay(date, resource.id), `${date}:${resource.id}`);

  const {confirmBook} = useBookingActions(reload);

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
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]'>
        <div className='flex min-h-full w-full flex-col px-5 pb-8 pt-2'>
          <h1 className='text-[27px] font-semibold tracking-tight text-theme-ink'>
            {formatLongDate(date)}
          </h1>
          {resource.tags.length > 0 ? (
            <div className='my-1 flex flex-wrap gap-1.5'>
              {resource.tags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          ) : null}
          <div className='mt-4 pb-4 flex grow flex-col'>
            <SlotList
              slots={day?.slots ?? null}
              resourceId={resource.id}
              error={error}
              onRetry={reload}
              onSelect={(slot) =>
                confirmBook(slot, resource, day?.active ?? null)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
