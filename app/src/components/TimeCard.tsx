import {Pressable, Text, View} from 'react-native';

import {formatLongDate, timeRange} from '@/lib/dates';

type TimeCardProps = {
  date: string;
  start: string;
  end: string;
  badge: string | null;
  actionLabel: string;
  onAction: () => void;
};

export function TimeCard({
  date,
  start,
  end,
  badge,
  actionLabel,
  onAction,
}: TimeCardProps) {
  return (
    <View className='mb-3 rounded-2xl bg-theme-surface px-5 py-4'>
      <View className='flex-row items-center justify-between'>
        <View className='flex-1 pr-3'>
          <Text className='text-2xl font-semibold tracking-tight text-theme-ink'>
            {timeRange(start, end)}
          </Text>
          <Text className='mt-1 text-sm font-medium capitalize text-theme-muted'>
            {formatLongDate(date)}
          </Text>
          {badge ? (
            <Text className='mt-2 self-start rounded-full bg-theme-mist px-3 py-1 text-xs font-semibold uppercase tracking-wide text-theme-accent'>
              {badge}
            </Text>
          ) : null}
        </View>
        <Pressable onPress={onAction} className='pt-1 active:opacity-60'>
          <Text className='rounded-2xl border border-theme-accent/20 px-4 py-2 text-base font-semibold text-theme-accent'>
            {actionLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
