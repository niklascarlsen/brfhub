import {describe, expect, test} from 'vitest';

import {sv as t} from '../i18n/sv';
import {checkPassword} from './drafts';
import {leaveField, nothingShown, problemShown} from './useProblems';

type Field = 'current' | 'next' | 'repeat';

const FIELDS = ['current', 'next', 'repeat'] as const;
const EMPTY = {current: '', next: '', repeat: ''};

function leftAll() {
  return FIELDS.reduce(leaveField, nothingShown<Field>());
}

describe('which problems a form shows', () => {
  test('leaving an empty field of an untouched form shows nothing', () => {
    const {problems, changed} = checkPassword(EMPTY, t);

    expect(changed).toBe(false);
    for (const field of FIELDS) {
      expect(problemShown(leftAll(), problems, field, changed)).toBeNull();
    }
  });

  test('nor after a reset, when the field that had focus is left', () => {
    const {problems, changed} = checkPassword(EMPTY, t);
    // What reset sets, and then the focused field blurs.
    const afterReset = leaveField(nothingShown<Field>(), 'repeat');

    expect(problemShown(afterReset, problems, 'repeat', changed)).toBeNull();
  });

  test('something missing shows once its field is left in a changed form', () => {
    const {problems, changed} = checkPassword({...EMPTY, current: 'old'}, t);
    const left = leaveField(nothingShown<Field>(), 'next');

    expect(changed).toBe(true);
    expect(problemShown(left, problems, 'next', changed)).toBe(
      t.admin.organization.passwordTooShort(8),
    );
    expect(problemShown(left, problems, 'repeat', changed)).toBeNull();
  });

  test('a save tried shows every problem', () => {
    const {problems} = checkPassword(EMPTY, t);
    const tried = {...nothingShown<Field>(), tried: true};

    expect(problemShown(tried, problems, 'current', false)).toBe(
      t.admin.field.required,
    );
  });

  test('a broken limit shows at once, left or not', () => {
    const next = 'x'.repeat(129);
    const {problems, changed} = checkPassword({...EMPTY, next}, t);

    expect(problemShown(nothingShown<Field>(), problems, 'next', changed)).toBe(
      t.admin.organization.passwordTooLong(128),
    );
  });

  test('leaving a field twice changes nothing', () => {
    const once = leaveField(nothingShown<Field>(), 'next');

    expect(leaveField(once, 'next')).toBe(once);
  });
});
