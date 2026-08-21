import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {ReservationCard} from '@/components/ReservationCard';
import {useBookings} from '@/context/BookingsContext';

export function ReservationScreen() {
  const {
    bookings,
    slots,
    currentUserId,
    loading,
    error,
    refresh,
    cancelBooking,
  } = useBookings();

  const mine = bookings
    .filter((booking) => booking.userId === currentUserId)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.slotId.localeCompare(b.slotId),
    );

  function handleCancel(id: string, label: string) {
    Alert.alert('Avboka tid', `Vill du avboka ${label}?`, [
      {text: 'Behåll', style: 'cancel'},
      {
        text: 'Avboka',
        style: 'destructive',
        onPress: () => {
          void cancelBooking(id);
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg'>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg px-8'>
        <Text className='text-center text-sm text-theme-muted'>{error}</Text>
        <Pressable
          onPress={() => void refresh()}
          className='mt-3 active:opacity-60'
        >
          <Text className='text-base font-semibold text-theme-accent'>
            Försök igen
          </Text>
        </Pressable>
      </View>
    );
  }

  if (mine.length === 0) {
    return (
      <View className='flex-1 items-center justify-center bg-theme-bg px-8'>
        <Text className='text-center text-xl font-semibold text-theme-ink'>
          Inga tider bokade
        </Text>
        <Text className='mt-2 text-center text-sm leading-5 text-theme-muted'>
          När du tar en lucka dyker den upp här.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className='flex-1 bg-theme-bg'
      contentContainerClassName='px-5 py-4 pb-8'
    >
      <Text className='mb-3 text-base font-medium text-theme-muted'>
        {mine.length === 1 ? '1 bokning' : `${mine.length} bokningar`}
      </Text>
      {mine.map((booking) => {
        const slot = slots.find((item) => item.id === booking.slotId);
        const label = slot ? `${slot.start}–${slot.end}` : booking.slotId;

        return (
          <ReservationCard
            key={booking.id}
            booking={booking}
            slot={slot}
            onCancel={() => handleCancel(booking.id, label)}
          />
        );
      })}
    </ScrollView>
  );
}
