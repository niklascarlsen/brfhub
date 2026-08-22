import {Pressable, Text, View} from 'react-native';

import type {Booking} from '@/api/client';
import {formatLongDate, timeRange} from '@/lib/dates';

type ReservationCardProps = {
  booking: Booking;
  onCancel: () => void;
};

export function ReservationCard({booking, onCancel}: ReservationCardProps) {
  return (
    <View className='mb-3 rounded-2xl bg-theme-surface px-5 py-4'>
      <View className='flex-row items-center justify-between'>
        <View className='flex-1 pr-3'>
          <Text className='text-2xl font-semibold tracking-tight text-theme-ink'>
            {timeRange(booking.start, booking.end)}
          </Text>
          <Text className='mt-1 text-sm font-medium capitalize text-theme-muted'>
            {formatLongDate(booking.date)}
          </Text>
        </View>
        <Pressable onPress={onCancel} className='pt-1 active:opacity-60'>
          <Text className='text-base font-semibold border border-theme-accent/20 rounded-2xl px-4 py-2 text-theme-accent'>
            Avboka
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
