import {describe, expect, test} from '@jest/globals';

import {isLocaleChoice, resolveLocale} from '@/i18n/catalog';

describe('resolveLocale', () => {
  test('a picked language wins over the device', () => {
    expect(resolveLocale('sv', ['en-US'])).toBe('sv');
    expect(resolveLocale('en', ['sv-SE'])).toBe('en');
  });

  test('the system choice takes the device language', () => {
    expect(resolveLocale('system', ['sv-SE', 'en-US'])).toBe('sv');
    expect(resolveLocale('system', ['en-GB', 'sv-SE'])).toBe('en');
  });

  test('a language the app does not speak is skipped for the next one', () => {
    expect(resolveLocale('system', ['de-DE', 'sv-SE'])).toBe('sv');
    expect(resolveLocale('system', ['nb'])).toBe('en');
    expect(resolveLocale('system', [])).toBe('en');
  });

  test('a bare language code still matches', () => {
    expect(resolveLocale('system', ['sv'])).toBe('sv');
  });
});

test('only a known choice is read back from storage', () => {
  expect(isLocaleChoice('system')).toBe(true);
  expect(isLocaleChoice('en')).toBe(true);
  expect(isLocaleChoice('de')).toBe(false);
  expect(isLocaleChoice(null)).toBe(false);
});
