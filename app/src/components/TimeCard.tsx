import {Pressable, Text, View} from 'react-native';

import {SkeletonBar} from '@/components/Skeleton';
import {formatLongDate, timeRange} from '@/lib/dates';

type Badge = {label: string; tone: 'accent' | 'muted'};

type TimeCardProps = {
  date: string;
  start: string;
  end: string;
  resourceName?: string;
  badge: Badge | null;
  actionLabel?: string;
  actionTone?: 'solid' | 'outline';
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

const tabularNums = {fontVariant: ['tabular-nums' as const]};

export function TimeCard({
  date,
  start,
  end,
  resourceName,
  badge,
  actionLabel,
  actionTone = 'outline',
  onAction,
  secondaryLabel,
  onSecondary,
}: TimeCardProps) {
  const solid = actionTone === 'solid';

  return (
    <View className='flex-row items-center gap-3.5 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'>
      <View className='min-w-0 flex-1 gap-1'>
        <View className='flex-row items-center gap-2'>
          {resourceName ? (
            <Text className='text-sm font-semibold text-theme-muted'>
              {resourceName}
            </Text>
          ) : null}
          {badge ? (
            <View
              className={`rounded-full px-[9px] py-1 ${
                badge.tone === 'accent' ? 'bg-theme-mist' : 'bg-theme-sunk'
              }`}
            >
              <Text
                className={`text-[10px] font-bold uppercase tracking-[1px] ${
                  badge.tone === 'accent'
                    ? 'text-theme-accent'
                    : 'text-theme-muted'
                }`}
              >
                {badge.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={tabularNums}
          className='text-[22px] font-semibold tracking-tight text-theme-ink'
        >
          {timeRange(start, end)}
        </Text>
        <Text className='text-[13px] font-medium text-theme-muted'>
          {formatLongDate(date)}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <View className='items-end gap-1.5'>
          <Pressable
            onPress={onAction}
            className={`h-11 items-center justify-center rounded-full px-5 active:opacity-70 ${
              solid
                ? 'bg-theme-ink'
                : 'border border-theme-edge bg-theme-surface'
            }`}
          >
            <Text
              className={`text-sm font-semibold tracking-tight ${
                solid ? 'text-theme-surface' : 'text-theme-ink'
              }`}
            >
              {actionLabel}
            </Text>
          </Pressable>
          {secondaryLabel && onSecondary ? (
            <Pressable
              onPress={onSecondary}
              className='h-[26px] justify-center px-1 active:opacity-60'
            >
              <Text className='text-[13px] font-medium text-theme-muted'>
                {secondaryLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TimeCardSkeleton() {
  return (
    <View className='flex-row items-center gap-3.5 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'>
      <View className='min-w-0 flex-1 gap-1'>
        <SkeletonBar className='h-4 w-[92px]' />
        <SkeletonBar className='h-[26px] w-[152px]' />
        <SkeletonBar className='h-4 w-[124px]' />
      </View>
      <View className='h-11 w-[94px] rounded-full bg-theme-sunk' />
    </View>
  );
}
