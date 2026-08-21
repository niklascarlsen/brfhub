import type {components} from '@/generated/api';

export type TimeSlot = components['schemas']['TimeSlot'];
export type Booking = components['schemas']['Booking'];
export type TimeSlotStatus = 'available' | 'booked' | 'mine';

export const CURRENT_USER_ID = 'me';
