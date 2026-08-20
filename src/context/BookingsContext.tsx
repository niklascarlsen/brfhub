import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {getUpcomingDays, toDateKey} from '@/data/bookableDates';
import type {Booking, TimeSlotStatus} from '@/booking';

export const CURRENT_USER_ID = 'me';
const OTHER_USER_ID = 'neighbour';

type BookingsContextValue = {
  bookings: Booking[];
  currentUserId: string;
  getSlotStatus: (date: string, slotId: string) => TimeSlotStatus;
  getBooking: (date: string, slotId: string) => Booking | undefined;
  bookSlot: (date: string, slotId: string) => void;
  cancelBooking: (id: string) => void;
};

const BookingsContext = createContext<BookingsContextValue | null>(null);

function createInitialBookings(): Booking[] {
  const days = getUpcomingDays(4);
  const today = days[0];
  const tomorrow = days[1];
  const inThreeDays = days[3];

  return [
    {
      id: 'seed-mine-today',
      date: toDateKey(today),
      slotId: '07-10',
      userId: CURRENT_USER_ID,
    },
    {
      id: 'seed-other-today',
      date: toDateKey(today),
      slotId: '16-19',
      userId: OTHER_USER_ID,
    },
    {
      id: 'seed-other-tomorrow',
      date: toDateKey(tomorrow),
      slotId: '10-13',
      userId: OTHER_USER_ID,
    },
    {
      id: 'seed-mine-later',
      date: toDateKey(inThreeDays),
      slotId: '19-22',
      userId: CURRENT_USER_ID,
    },
  ];
}

export function BookingsProvider({children}: {children: ReactNode}) {
  const [bookings, setBookings] = useState<Booking[]>(createInitialBookings);

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

  const bookSlot = useCallback((date: string, slotId: string) => {
    setBookings((current) => {
      const taken = current.some(
        (booking) => booking.date === date && booking.slotId === slotId,
      );
      if (taken) {
        return current;
      }

      return [
        ...current,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          slotId,
          userId: CURRENT_USER_ID,
        },
      ];
    });
  }, []);

  const cancelBooking = useCallback((id: string) => {
    setBookings((current) =>
      current.filter(
        (booking) => !(booking.id === id && booking.userId === CURRENT_USER_ID),
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      bookings,
      currentUserId: CURRENT_USER_ID,
      getSlotStatus,
      getBooking,
      bookSlot,
      cancelBooking,
    }),
    [bookings, getSlotStatus, getBooking, bookSlot, cancelBooking],
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
