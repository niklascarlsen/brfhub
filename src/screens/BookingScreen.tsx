import {useState} from 'react';
import {Alert, ScrollView, Text, View} from 'react-native';

import {DatePicker} from '@/components/DatePicker';
import {DateTimeSlots} from '@/components/DateTimeSlots';
import {useBookings} from '@/context/BookingsContext';
import {formatLongDate, getBookableDays, toDateKey} from '@/data/bookableDates';
import {LAUNDRY_TIME_SLOTS} from '@/data/laundryTimeSlots';

const BOOKABLE_DAYS = getBookableDays();

export function BookingScreen() {
  const [selectedDate, setSelectedDate] = useState(BOOKABLE_DAYS[0]);
  const {getSlotStatus, getBooking, bookSlot, cancelBooking} = useBookings();
  const dateKey = toDateKey(selectedDate);

  function handlePress(slotId: string, start: string, end: string) {
    const status = getSlotStatus(dateKey, slotId);

    if (status === 'booked') {
      return;
    }

    if (status === 'mine') {
      const booking = getBooking(dateKey, slotId);
      if (!booking) {
        return;
      }

      Alert.alert('Avboka tid', `Vill du avboka ${start}–${end}?`, [
        {text: 'Behåll', style: 'cancel'},
        {
          text: 'Avboka',
          style: 'destructive',
          onPress: () => cancelBooking(booking.id),
        },
      ]);
      return;
    }

    Alert.alert('Boka tid', `Vill du boka ${start}–${end}?`, [
      {text: 'Avbryt', style: 'cancel'},
      {text: 'Boka', onPress: () => bookSlot(dateKey, slotId)},
    ]);
  }

  return (
    <View className='flex-1 bg-theme-bg'>
      <DatePicker
        days={BOOKABLE_DAYS}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />
      <ScrollView
        className='w-full flex-1 px-5 pt-2'
        contentContainerClassName='w-full grow pb-8'
      >
        <Text className='mb-1 mt-2 text-2xl font-semibold capitalize tracking-tight text-theme-ink'>
          {formatLongDate(dateKey)}
        </Text>
        <Text className='mb-5 text-sm text-theme-muted'>
          Välj en ledig lucka
        </Text>
        {LAUNDRY_TIME_SLOTS.map((slot) => (
          <DateTimeSlots
            key={slot.id}
            slot={slot}
            status={getSlotStatus(dateKey, slot.id)}
            onPress={() => handlePress(slot.id, slot.start, slot.end)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
