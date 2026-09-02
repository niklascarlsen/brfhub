import Ionicons from '@expo/vector-icons/Ionicons';
import {Pressable, Text, View} from 'react-native';

import type {Slot} from '@/api/client';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {timeRange} from '@/lib/dates';
import {exhaustive} from '@/lib/exhaustive';
import {theme} from '../../theme';

type TimeSlotRowProps = {
  slot: Slot;
  onPress: () => void;
};

type Appearance = {
  surface: string;
  time: string;
  label: string;
  tone: string;
  mark: 'dot' | 'lock' | null;
  chevron: boolean;
};

const tabularNums = {fontVariant: ['tabular-nums' as const]};

function appearanceOf(slot: Slot): Appearance {
  switch (slot.status) {
    case 'mine':
      return {
        surface: 'bg-theme-mist',
        time: 'text-theme-ink',
        label: 'Din tid',
        tone: 'font-semibold text-theme-accent',
        mark: 'dot',
        chevron: false,
      };
    case 'available':
      return slot.subscriptionId
        ? {
            surface: 'border border-theme-accent bg-theme-surface',
            time: 'text-theme-ink',
            label: 'Ledig nu',
            tone: 'font-semibold text-theme-accent',
            mark: null,
            chevron: true,
          }
        : {
            surface: 'border border-theme-line bg-theme-surface',
            time: 'text-theme-ink',
            label: 'Ledig',
            tone: 'font-medium text-theme-muted',
            mark: null,
            chevron: true,
          };
    case 'walkin':
      return {
        surface: 'bg-theme-sunk',
        time: 'text-theme-faint',
        label: 'Drop-in',
        tone: 'font-medium text-theme-faint',
        mark: 'lock',
        chevron: false,
      };
    case 'booked':
      return {
        surface: 'bg-theme-sunk',
        time: 'text-theme-faint',
        label: slot.subscriptionId ? 'I kö' : 'Upptagen',
        tone: slot.subscriptionId
          ? 'font-medium text-theme-accent'
          : 'font-medium text-theme-faint',
        mark: slot.started ? 'lock' : null,
        chevron: false,
      };
    default:
      return exhaustive(slot);
  }
}

export function TimeSlotRow({slot, onPress}: TimeSlotRowProps) {
  const {status} = slot;
  const locked = status === 'walkin' || (status === 'booked' && slot.started);
  const {surface, time, label, tone, mark, chevron} = appearanceOf(slot);

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      className={`h-[66px] w-full flex-row items-center justify-between rounded-2xl px-[18px] ${surface} ${
        locked ? '' : 'active:opacity-80'
      }`}
    >
      <Text
        style={tabularNums}
        className={`text-[17px] font-semibold tracking-tight ${time}`}
      >
        {timeRange(slot.start, slot.end)}
      </Text>
      <View className='flex-row items-center gap-2'>
        {mark === 'dot' ? (
          <View className='h-1.5 w-1.5 rounded-full bg-theme-accent' />
        ) : null}
        {mark === 'lock' ? (
          <Ionicons name='lock-closed' size={13} color={theme.faint} />
        ) : null}
        <Text className={`text-[13px] ${tone}`}>{label}</Text>
        {chevron ? (
          <Ionicons name='chevron-forward' size={15} color={theme.edge} />
        ) : null}
      </View>
    </Pressable>
  );
}

function TimeSlotRowSkeleton() {
  return (
    <View className='h-[66px] w-full flex-row items-center justify-between rounded-2xl border border-theme-line bg-theme-surface px-[18px]'>
      <SkeletonBar className='h-3.5 w-[108px]' />
      <SkeletonBar className='h-3 w-11' />
    </View>
  );
}

export function TimeSlotListSkeleton({rows}: {rows: number}) {
  return (
    <Skeleton>
      <View className='gap-[9px]'>
        {Array.from({length: rows}, (_, row) => (
          <TimeSlotRowSkeleton key={row} />
        ))}
      </View>
    </Skeleton>
  );
}
