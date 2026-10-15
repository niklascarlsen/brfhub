import {describe, expect, test} from 'vitest';

import {sv} from '../i18n/sv';
import {closedNotice, closingRule, firstOpenResource} from './closing';

const t = sv;

describe('a closed resource', () => {
  test('is not where the booking page opens', () => {
    expect(
      firstOpenResource([
        {id: 'laundry-1', closed: true},
        {id: 'laundry-2', closed: false},
      ]).id,
    ).toBe('laundry-2');
    expect(firstOpenResource([{id: 'sauna', closed: true}]).id).toBe('sauna');
  });

  test('says what the admin wrote, or that it cannot be booked', () => {
    expect(closedNotice({closingNote: 'Maskinen är trasig'}, t)).toEqual({
      title: 'Tillfälligt stängd',
      message: 'Maskinen är trasig',
    });
    expect(closedNotice({closingNote: ''}, t).message).toBe(
      'Den går inte att boka just nu.',
    );
  });

  test('adds a rule while closed or closing', () => {
    const open = {closed: false, closesFrom: null, closingNote: ''};

    expect(closingRule(open, t)).toBeNull();
    expect(
      closingRule(
        {...open, closesFrom: '2026-11-05', closingNote: 'Ny maskin'},
        t,
      ),
    ).toBe('Stängs 5 november. Ny maskin');
    expect(
      closingRule({closed: true, closesFrom: '2026-10-15', closingNote: ''}, t),
    ).toBe('Tillfälligt stängd');
  });
});
