import {describe, expect, test} from 'vitest';

import {ruleParagraphs} from './rules';

describe('ruleParagraphs', () => {
  test('splits on blank lines and keeps single line breaks', () => {
    expect(ruleParagraphs('Clean up.\n\nBe on time.\nOr lose it.')).toEqual([
      'Clean up.',
      'Be on time.\nOr lose it.',
    ]);
  });

  test('ignores extra blank lines and whitespace around them', () => {
    expect(ruleParagraphs('\n One. \n \n\n\nTwo.\n')).toEqual(['One.', 'Two.']);
  });

  test('a text without paragraphs is one rule', () => {
    expect(ruleParagraphs('Only this.')).toEqual(['Only this.']);
  });
});
