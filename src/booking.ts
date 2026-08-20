export type TimeSlot = {
  id: string;
  start: string;
  end: string;
};

export type Booking = {
  id: string;
  date: string;
  slotId: string;
  userId: string;
};

export type TimeSlotStatus = 'available' | 'booked' | 'mine';
