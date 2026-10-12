import type {BookingWindow, Resource} from '@booking/core/api/types';
import {daysBetween, toIsoDate} from '@booking/core/lib/dates';
import {useMemo} from 'react';
import {View} from 'react-native';

import {DatePicker} from '@/components/DatePicker';
import {ResourcePicker} from '@/components/ResourcePicker';

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
      <View className='pb-3 pt-1'>
        <ResourcePicker
          resources={resources}
          selectedId={resource.id}
          onSelect={onSelectResource}
        />
      </View>
      <DatePicker
        days={days}
        selectedIso={isoDate}
        todayIso={bookingWindow.today}
        onSelect={(day) => onSelectDate(toIsoDate(day))}
      />
    </>
  );
}
