import {describe, expect, test} from 'vitest';

import {sv} from '../i18n/sv';
import {asksReason, CANCELS_NAMED, cancelsMessage, changeDays} from './change';

const t = sv;

describe('the days a change can start on', () => {
  test('new times start tomorrow, at the first free day', () => {
    expect(changeDays('schedule', '2026-10-31', '2026-11-04')).toEqual({
      first: '2026-11-01',
      free: '2026-11-04',
      chosen: '2026-11-04',
    });
  });

  test('a closing starts today, also when it cancels bookings', () => {
    expect(changeDays('closing', '2026-10-15', '2026-11-05')).toEqual({
      first: '2026-10-15',
      free: '2026-11-05',
      chosen: '2026-10-15',
    });
  });

  test('new times never start before tomorrow, even with nothing booked', () => {
    expect(changeDays('schedule', '2026-10-15', '2026-10-15').free).toBe(
      '2026-10-16',
    );
  });
});

describe('the message a change asks for', () => {
  test('a closing always asks, new times only on a day that can cancel', () => {
    expect(asksReason('closing', '2026-11-05', '2026-11-05')).toBe(true);
    expect(asksReason('schedule', '2026-11-04', '2026-11-05')).toBe(true);
    expect(asksReason('schedule', '2026-11-05', '2026-11-05')).toBe(false);
  });
});

describe('the bookings a change cancels', () => {
  const booking = (apartment: string, date: string) => ({
    id: `${apartment}-${date}`,
    apartment,
    date,
    start: '07:00',
    end: '10:00',
  });

  test('names each with its apartment and time', () => {
    expect(cancelsMessage([booking('12', '2026-10-17')], t)).toBe(
      'Lgh 12: lördag 17 oktober 07:00\u2060–\u206010:00\n\nLägenheten får ett mejl och en notis om det.',
    );
  });

  test('says how many more past the ones it names', () => {
    const many = Array.from({length: CANCELS_NAMED + 3}, (_, index) =>
      booking(String(index + 1), '2026-10-17'),
    );
    const lines = cancelsMessage(many, t).split('\n');

    expect(lines[CANCELS_NAMED]).toBe('och 3 till');
    expect(lines.at(-1)).toBe('Lägenheterna får ett mejl och en notis om det.');
  });
});
