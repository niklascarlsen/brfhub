import {useMemo} from 'react';
import {View} from 'react-native';

import type {BookingWindow, Resource} from '@/api/client';
import {DatePicker} from '@/components/DatePicker';
import {ResourcePicker} from '@/components/ResourcePicker';
import {daysBetween, fromIsoDate, toIsoDate} from '@/lib/dates';

type BookingHeaderProps = {
  resources: Resource[];
  resource: Resource;
  onSelectResource: (id: string) => void;
  window: BookingWindow;
  isoDate: string;
  onSelectDate: (isoDate: string) => void;
};

export function BookingHeader({
  resources,
  resource,
  onSelectResource,
  window,
  isoDate,
  onSelectDate,
}: BookingHeaderProps) {
  const days = useMemo(() => daysBetween(window.from, window.to), [window]);

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
        selectedDate={fromIsoDate(isoDate)}
        todayIso={window.today}
        onSelect={(day) => onSelectDate(toIsoDate(day))}
      />
    </>
  );
}
