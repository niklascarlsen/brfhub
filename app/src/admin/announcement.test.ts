import {describe, expect, test} from '@jest/globals';

import {durationOf, endsOnAfter, startOf} from '@/admin/announcement';

describe('announcement durations', () => {
  test('a week counts the first day as one', () => {
    expect(endsOnAfter('2026-10-09', 7)).toBe('2026-10-15');
    expect(endsOnAfter('2026-10-30', 7)).toBe('2026-11-05');
  });

  test('an older announcement is extended from today', () => {
    expect(startOf('2026-09-01', '2026-10-09')).toBe('2026-10-09');
    expect(startOf('2026-10-12', '2026-10-09')).toBe('2026-10-12');
  });

  test('recognizes the duration it was given', () => {
    expect(durationOf('2026-10-09', null)).toBeNull();
    expect(durationOf('2026-10-09', '2026-10-22')).toBe(14);
    expect(durationOf('2026-10-09', '2026-10-20')).toBe('custom');
  });
});
