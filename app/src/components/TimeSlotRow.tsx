import {Pressable, Text, View} from 'react-native';

import type {Slot} from '@/api/client';
import {timeRange} from '@/lib/dates';

type TimeSlotRowProps = {
  slot: Slot;
  onPress: () => void;
};

function statusLabel(slot: Slot): string {
  if (slot.status === 'mine') {
    return 'Din tid';
  }

  if (slot.status === 'available') {
    return 'Ledig';
  }

  if (slot.status === 'walkin') {
    return 'Drop-in';
  }

  return slot.subscriptionId ? 'I kö' : 'Upptagen';
}

export function TimeSlotRow({slot, onPress}: TimeSlotRowProps) {
  const {status} = slot;
  const queued = status === 'booked' && slot.subscriptionId !== null;

  return (
    <Pressable
      onPress={onPress}
      className={`mb-2.5 w-full flex-row items-center justify-between rounded-2xl px-4 py-4 ${
        status === 'mine'
          ? 'bg-theme-mist'
          : status === 'booked' || status === 'walkin'
            ? 'bg-theme-surface/50 active:opacity-80'
            : 'bg-theme-surface active:opacity-80'
      }`}
    >
      <View>
        <Text
          className={`text-lg font-semibold tracking-tight ${
            status === 'booked' || status === 'walkin'
              ? 'text-theme-muted'
              : 'text-theme-ink'
          }`}
        >
          {timeRange(slot.start, slot.end)}
        </Text>
      </View>
      <Text
        className={`font-medium ${
          status === 'mine'
            ? ' text-lg text-theme-accent'
            : queued
              ? 'text-theme-accent text-sm'
              : status === 'booked' || status === 'walkin'
                ? 'text-theme-muted text-sm'
                : 'text-theme-ink text-sm'
        }`}
      >
        {statusLabel(slot)}
      </Text>
    </Pressable>
  );
}
