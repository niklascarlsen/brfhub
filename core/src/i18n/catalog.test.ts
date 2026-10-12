import {describe, expect, test} from 'vitest';

import {isLocaleChoice, localize, resolveLocale} from './catalog';

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

  test("only the organization's languages can be shown", () => {
    expect(resolveLocale('en', ['en-US'], ['sv'])).toBe('sv');
    expect(resolveLocale('system', ['de-DE', 'sv-SE'], ['en'])).toBe('en');
    expect(resolveLocale('system', ['de-DE'], ['sv', 'en'])).toBe('en');
    expect(resolveLocale('system', ['en-GB', 'sv-SE'], ['sv', 'en'])).toBe(
      'en',
    );
  });
});

describe('localize', () => {
  test('takes the language shown', () => {
    expect(localize({sv: 'Tvätt', en: 'Laundry'}, 'en')).toBe('Laundry');
  });

  test('falls back to a language the text is written in', () => {
    expect(localize({sv: 'Tvätt'}, 'en')).toBe('Tvätt');
    expect(localize({}, 'en')).toBeUndefined();
  });
});

test('only a known choice is read back from storage', () => {
  expect(isLocaleChoice('system')).toBe(true);
  expect(isLocaleChoice('en')).toBe(true);
  expect(isLocaleChoice('de')).toBe(false);
  expect(isLocaleChoice(null)).toBe(false);
});
