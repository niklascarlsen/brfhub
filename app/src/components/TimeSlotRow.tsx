import {Pressable, Text, View} from 'react-native';

import type {Slot} from '@/api/client';
import {timeRange} from '@/lib/dates';
import {exhaustive} from '@/lib/exhaustive';

type TimeSlotRowProps = {
  slot: Slot;
  onPress: () => void;
};

function statusLabel(slot: Slot): string {
  switch (slot.status) {
    case 'mine':
      return 'Din tid';
    case 'available':
      return slot.subscriptionId ? 'Ledig nu' : 'Ledig';
    case 'walkin':
      return 'Drop-in';
    case 'booked':
      return slot.subscriptionId ? 'I kö' : 'Upptagen';
    default:
      return exhaustive(slot);
  }
}

export function TimeSlotRow({slot, onPress}: TimeSlotRowProps) {
  const {status} = slot;
  const queued = status === 'booked' && slot.subscriptionId !== null;
  const released = status === 'available' && slot.subscriptionId !== null;
  const locked = status === 'walkin' || (status === 'booked' && slot.started);

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      className={`mb-2.5 w-full flex-row items-center justify-between rounded-2xl px-4 py-4 ${
        status === 'mine'
          ? 'bg-theme-mist'
          : status === 'booked' || status === 'walkin'
            ? 'bg-theme-surface/50'
            : 'bg-theme-surface'
      } ${locked ? '' : 'active:opacity-80'}`}
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
            : queued || released
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
