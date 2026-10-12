import {describe, expect, test} from 'vitest';

import {en} from '../i18n/en';
import {sv} from '../i18n/sv';
import {untranslatedMessage} from './localized';

const NONE = {kinds: 0, resources: 0, announcements: 0, rules: false};

describe('the bar for text that lacks a language', () => {
  test('says nothing when every text is written', () => {
    expect(untranslatedMessage(null, sv)).toBeNull();
  });

  test('names what lacks the language, in the order of the tabs', () => {
    expect(
      untranslatedMessage(
        {...NONE, locales: ['en'], resources: 2, kinds: 1, rules: true},
        sv,
      ),
    ).toBe(
      'Inte översatt till engelska än: 2 resurser, 1 typ och ordningsreglerna.',
    );
  });

  test('names one thing and every language it lacks', () => {
    expect(
      untranslatedMessage(
        {...NONE, locales: ['sv', 'en'], announcements: 1},
        en,
      ),
    ).toBe('Not yet in Swedish and English: 1 notice.');
  });
});
