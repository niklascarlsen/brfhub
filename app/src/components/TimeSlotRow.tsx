import {Pressable, Text, View} from 'react-native';

import type {Slot} from '@/api/client';
import {timeRange} from '@/lib/dates';

type TimeSlotRowProps = {
  slot: Slot;
  onPress: () => void;
};

const STATUS_LABEL = {
  available: 'Ledig',
  booked: 'Upptagen',
  mine: 'Din tid',
} as const;

export function TimeSlotRow({slot, onPress}: TimeSlotRowProps) {
  const {status} = slot;
  const disabled = status === 'booked';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`mb-2.5 w-full flex-row items-center justify-between rounded-2xl px-4 py-4 ${
        status === 'mine'
          ? 'bg-theme-mist'
          : status === 'booked'
            ? 'bg-theme-surface/50'
            : 'bg-theme-surface active:opacity-80'
      }`}
    >
      <View>
        <Text
          className={`text-lg font-semibold tracking-tight ${
            status === 'booked' ? 'text-theme-muted' : 'text-theme-ink'
          }`}
        >
          {timeRange(slot.start, slot.end)}
        </Text>
      </View>
      <Text
        className={`font-medium ${
          status === 'mine'
            ? ' text-lg text-theme-accent'
            : status === 'booked'
              ? 'text-theme-muted text-sm'
              : 'text-theme-ink text-sm'
        }`}
      >
        {STATUS_LABEL[status]}
      </Text>
    </Pressable>
  );
}
