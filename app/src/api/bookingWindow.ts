import {api, unwrap, type BookingWindow} from '@/api/client';
import {toIsoDate} from '@/lib/dates';

let cached: {day: string; window: BookingWindow} | null = null;

export async function getBookingWindow(): Promise<BookingWindow> {
  const day = toIsoDate(new Date());

  if (cached?.day !== day) {
    cached = {day, window: await unwrap(api.GET('/booking-window'))};
  }

  return cached.window;
}
