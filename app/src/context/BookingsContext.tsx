import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {Alert} from 'react-native';

import {api, readResult} from '@/api/client';
import {
  CURRENT_USER_ID,
  type Booking,
  type TimeSlot,
  type TimeSlotStatus,
} from '@/booking';

type BookingsContextValue = {
  bookings: Booking[];
  slots: TimeSlot[];
  currentUserId: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getSlotStatus: (date: string, slotId: string) => TimeSlotStatus;
  getBooking: (date: string, slotId: string) => Booking | undefined;
  bookSlot: (date: string, slotId: string) => Promise<void>;
  cancelBooking: (id: string) => Promise<void>;
};

const BookingsContext = createContext<BookingsContextValue | null>(null);

export function BookingsProvider({children}: {children: ReactNode}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [slotsRes, bookingsRes] = await Promise.all([
        readResult<TimeSlot[]>(api.GET('/slots'), 'Kunde inte hämta tider'),
        readResult<Booking[]>(
          api.GET('/bookings'),
          'Kunde inte hämta bokningar',
        ),
      ]);

      if (!slotsRes.ok) {
        setError(slotsRes.message);
        return;
      }

      if (!bookingsRes.ok) {
        setError(bookingsRes.message);
        return;
      }

      setSlots(slotsRes.data);
      setBookings(bookingsRes.data);
      setError(null);
    } catch {
      setError('Kunde inte nå servern');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      await refresh();
      if (!cancelled) {
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const getBooking = useCallback(
    (date: string, slotId: string) =>
      bookings.find(
        (booking) => booking.date === date && booking.slotId === slotId,
      ),
    [bookings],
  );

  const getSlotStatus = useCallback(
    (date: string, slotId: string): TimeSlotStatus => {
      const booking = getBooking(date, slotId);
      if (!booking) {
        return 'available';
      }
      return booking.userId === CURRENT_USER_ID ? 'mine' : 'booked';
    },
    [getBooking],
  );

  const bookSlot = useCallback(
    async (date: string, slotId: string) => {
      try {
        const {
          data,
          error: apiError,
          response,
        } = await api.POST('/bookings', {
          body: {date, slotId},
        });

        if (response.status === 409) {
          Alert.alert('Tiden är redan bokad');
          await refresh();
          return;
        }

        if (apiError || !data) {
          Alert.alert('Kunde inte boka', apiError?.message ?? 'Försök igen.');
          return;
        }

        setBookings((current) => [...current, data]);
      } catch {
        Alert.alert('Kunde inte nå servern');
      }
    },
    [refresh],
  );

  const cancelBooking = useCallback(async (id: string) => {
    try {
      const {error: apiError} = await api.DELETE('/bookings/{id}', {
        params: {path: {id}},
      });

      if (apiError) {
        Alert.alert('Kunde inte avboka', apiError.message ?? 'Försök igen.');
        return;
      }

      setBookings((current) => current.filter((booking) => booking.id !== id));
    } catch {
      Alert.alert('Kunde inte nå servern');
    }
  }, []);

  const value = useMemo(
    () => ({
      bookings,
      slots,
      currentUserId: CURRENT_USER_ID,
      loading,
      error,
      refresh,
      getSlotStatus,
      getBooking,
      bookSlot,
      cancelBooking,
    }),
    [
      bookings,
      slots,
      loading,
      error,
      refresh,
      getSlotStatus,
      getBooking,
      bookSlot,
      cancelBooking,
    ],
  );

  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error('useBookings must be used within BookingsProvider');
  }
  return context;
}
