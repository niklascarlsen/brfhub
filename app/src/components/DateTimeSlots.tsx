import {Pressable, Text, View} from 'react-native';

import type {TimeSlot, TimeSlotStatus} from '@/booking';

type DateTimeSlotsProps = {
  slot: TimeSlot;
  status: TimeSlotStatus;
  onPress: () => void;
};

const STATUS_LABEL: Record<TimeSlotStatus, string> = {
  available: 'Ledig',
  booked: 'Upptagen',
  mine: 'Din tid',
};

export function DateTimeSlots({slot, status, onPress}: DateTimeSlotsProps) {
  const disabled = status === 'booked';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      className={`mb-2.5 w-full flex-row items-center justify-between rounded-2xl px-4 py-4 ${
        status === 'mine'
          ? 'border border-theme-line bg-theme-mist'
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
          {slot.start}–{slot.end}
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
