import {describe, expect, test} from '@jest/globals';

import {nextSlot, slotsProblem} from '@/admin/schedule';
import type {SlotInput} from '@/api/client';

const slot = (
  start: string,
  end: string,
  endOffsetDays: 0 | 1 = 0,
): SlotInput => ({
  start,
  end,
  endOffsetDays,
});

describe('slotsProblem', () => {
  test('accepts a day of slots and a night slot', () => {
    expect(
      slotsProblem([slot('08:00', '20:00'), slot('20:00', '08:00', 1)]),
    ).toBeNull();
  });

  test('asks for at least one slot', () => {
    expect(slotsProblem([])).toBe('Lägg till minst ett pass');
  });

  test('refuses a time that is not a time of day', () => {
    for (const time of ['', '8:00', '25:00', '12:60']) {
      expect(slotsProblem([slot(time, '12:00')])).toBe(
        'Skriv tiderna som 08:00',
      );
    }
  });

  test('refuses a slot that ends before it starts on the same day', () => {
    expect(slotsProblem([slot('20:00', '02:00')])).toMatch(/nästa dag/);
    expect(slotsProblem([slot('10:00', '10:00')])).toMatch(/nästa dag/);
  });
});

describe('nextSlot', () => {
  test('follows the last slot and lasts as long', () => {
    expect(nextSlot([slot('08:00', '11:00')])).toEqual(slot('11:00', '14:00'));
  });

  test('runs into the next day past midnight', () => {
    expect(nextSlot([slot('19:00', '22:00')])).toEqual(
      slot('22:00', '01:00', 1),
    );
  });
});
