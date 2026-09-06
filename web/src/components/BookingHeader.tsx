import {useMemo} from 'react';

import type {BookingWindow, Resource} from '@/api/client';
import {DatePicker} from '@/components/DatePicker';
import {ResourcePicker} from '@/components/ResourcePicker';
import {daysBetween, toIsoDate} from '@/lib/dates';

type BookingHeaderProps = {
  resources: Resource[];
  resource: Resource;
  onSelectResource: (id: string) => void;
  bookingWindow: BookingWindow;
  isoDate: string;
  onSelectDate: (isoDate: string) => void;
};

export function BookingHeader({
  resources,
  resource,
  onSelectResource,
  bookingWindow,
  isoDate,
  onSelectDate,
}: BookingHeaderProps) {
  const days = useMemo(
    () => daysBetween(bookingWindow.from, bookingWindow.to),
    [bookingWindow],
  );

  return (
    <>
      <div className='mt-4 pb-3 pt-1 px-5'>
        <ResourcePicker
          resources={resources}
          selectedId={resource.id}
          onSelect={onSelectResource}
        />
      </div>
      <DatePicker
        days={days}
        selectedIso={isoDate}
        todayIso={bookingWindow.today}
        onSelect={(day) => onSelectDate(toIsoDate(day))}
      />
    </>
  );
}
