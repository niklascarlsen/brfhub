import type {Slot} from '@booking/core/api/types';
import type {SlotLook, SlotOffer, SlotTone} from '@booking/core/booking/offer';
import {timeRange} from '@booking/core/lib/dates';
import Ionicons from '@expo/vector-icons/Ionicons';
import {Pressable, Text, View} from 'react-native';

import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import theme from '@/theme.json';

type TimeSlotRowProps = {
  slot: Slot;
  offer: SlotOffer;
  onPress: () => void;
};

type Appearance = {
  surface: string;
  time: string;
  chevron: boolean;
};

const tabularNums = {fontVariant: ['tabular-nums' as const]};

const LOOKS: Record<SlotLook, Appearance> = {
  mine: {surface: 'bg-theme-mist', time: 'text-theme-ink', chevron: false},
  freeNow: {
    surface: 'border border-theme-accent bg-theme-surface',
    time: 'text-theme-ink',
    chevron: true,
  },
  free: {
    surface: 'border border-theme-line bg-theme-surface',
    time: 'text-theme-ink',
    chevron: true,
  },
  closed: {surface: 'bg-theme-sunk', time: 'text-theme-faint', chevron: false},
};

const TONES: Record<SlotTone, string> = {
  strong: 'font-semibold text-theme-accent',
  accent: 'font-medium text-theme-accent',
  muted: 'font-medium text-theme-muted',
  faint: 'font-medium text-theme-faint',
};

export function TimeSlotRow({slot, offer, onPress}: TimeSlotRowProps) {
  const {locked, label, mark} = offer;
  const {surface, time, chevron} = LOOKS[offer.look];
  const tone = TONES[offer.tone];

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
