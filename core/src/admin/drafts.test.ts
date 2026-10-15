import {describe, expect, test} from 'vitest';

import {apiError} from '../api/errors';
import type {SlotInput} from '../api/types';
import {limits} from '../generated/limits';
import {en} from '../i18n/en';
import {sv} from '../i18n/sv';
import {
  canAddSlot,
  checkAnnouncement,
  checkApartment,
  checkDetails,
  checkKind,
  checkPassword,
  checkResource,
  checkRules,
  checkClosing,
  checkSchedule,
  failureMessage,
  hasProblems,
  isSame,
  shownProblem,
  stepMaxActive,
  tagsText,
} from './drafts';

const t = sv;
const REQUIRED = {message: t.admin.field.required, missing: true};

function tooLong(length: number, max: number) {
  return {message: t.admin.field.tooLong(length, max), missing: false};
}

const slot = (start: string, end: string): SlotInput => ({
  start,
  end,
  endOffsetDays: 0,
});

describe('isSame', () => {
  test('compares content, not the order of keys', () => {
    expect(isSame({sv: 'a', en: 'b'}, {en: 'b', sv: 'a'})).toBe(true);
    expect(isSame([slot('08:00', '11:00')], [slot('08:00', '11:00')])).toBe(
      true,
    );
    expect(isSame({sv: 'a'}, {sv: 'b'})).toBe(false);
    expect(isSame(['a'], ['a', 'b'])).toBe(false);
    expect(isSame({a: 1}, [1])).toBe(false);
    expect(isSame(null, {})).toBe(false);
  });

  test('takes a key left undefined as absent, as it is once sent', () => {
    expect(isSame({sv: 'a', en: undefined}, {sv: 'a'})).toBe(true);
  });
});

describe('what a form shows of a problem', () => {
  test('a broken limit at once', () => {
    expect(shownProblem(tooLong(21, 20), false)).toBe(
      t.admin.field.tooLong(21, 20),
    );
  });

  test('something missing once its field has been left', () => {
    expect(shownProblem(REQUIRED, false)).toBeNull();
    expect(shownProblem(REQUIRED, true)).toBe(t.admin.field.required);
    expect(shownProblem(undefined, true)).toBeNull();
  });

  test('a field without a problem does not count', () => {
    expect(hasProblems({label: undefined})).toBe(false);
    expect(hasProblems({label: REQUIRED})).toBe(true);
  });
});

describe('the limits come from the server', () => {
  test('as its schemas state them', () => {
    expect(limits.CreateApartmentBody.label.maxLength).toBe(20);
    expect(limits.AnnouncementBody.body.maxLength).toBe(2000);
    expect(limits.CreateResourceBody.tags).toEqual({
      maxItems: 5,
      items: {minLength: 1, maxLength: 30},
    });
    expect(limits.ChangePasswordBody.newPassword.minLength).toBe(8);
  });
});

describe('an apartment', () => {
  const saved = {label: '12', residentName: 'Anna', email: '12@example.com'};

  test('is unchanged by spaces around what is typed', () => {
    const checked = checkApartment(
      {...saved, residentName: ' Anna '},
      saved,
      true,
      t,
    );

    expect(checked.changed).toBe(false);
    expect(checked.value).toEqual(saved);
    expect(hasProblems(checked.problems)).toBe(false);
  });

  test('needs every field, and a number no longer than the server takes', () => {
    const {problems} = checkApartment(
      {label: '1'.repeat(21), residentName: ' ', email: ''},
      saved,
      true,
      t,
    );

    expect(problems).toEqual({
      label: tooLong(21, 20),
      residentName: REQUIRED,
      email: REQUIRED,
    });
  });

  test('a new resident keeps the number, so it is not checked', () => {
    const {problems} = checkApartment(
      {label: '', residentName: 'Bo', email: 'bo@example.com'},
      saved,
      false,
      t,
    );

    expect(hasProblems(problems)).toBe(false);
  });
});

describe('an announcement', () => {
  const saved = {title: {sv: 'Städdag'}, body: {sv: 'Lördag.'}, endsOn: null};

  test('is checked in every language of the organization', () => {
    const {problems} = checkAnnouncement(
      {
        title: {sv: 'Städdag', en: ''},
        body: {sv: 'x'.repeat(2001)},
        endsOn: null,
      },
      saved,
      ['sv', 'en'],
      t,
    );

    expect(problems).toEqual({
      'title.en': REQUIRED,
      'body.sv': tooLong(2001, 2000),
      'body.en': REQUIRED,
    });
  });

  test('a language the organization no longer uses changes nothing', () => {
    const checked = checkAnnouncement(
      {...saved, title: {sv: 'Städdag', en: 'Cleaning day'}},
      saved,
      ['sv'],
      t,
    );

    expect(checked.changed).toBe(false);
    expect(checked.value.title).toEqual({sv: 'Städdag'});
  });

  test('a new end date is a change', () => {
    expect(
      checkAnnouncement({...saved, endsOn: '2030-01-07'}, saved, ['sv'], t)
        .changed,
    ).toBe(true);
  });
});

describe('a kind', () => {
  test('needs a name no longer than the server takes', () => {
    const {problems, changed} = checkKind(
      {name: {sv: 'x'.repeat(41)}, maxActive: 1},
      {name: {}, maxActive: 1},
      ['sv'],
      t,
    );

    expect(changed).toBe(true);
    expect(problems).toEqual({'name.sv': tooLong(41, 40)});
  });

  test('its limit steps within what the server takes', () => {
    expect(stepMaxActive(1, -1)).toBe(1);
    expect(stepMaxActive(1, 1)).toBe(2);
    expect(stepMaxActive(10, 1)).toBe(10);
  });
});

describe('a resource', () => {
  const saved = {
    name: {sv: 'Tvättstuga 1', en: 'Laundry room 1'},
    kindId: 'laundry',
    tags: {sv: ['Källaren'], en: ['Basement']},
    slots: [],
  };
  const options = {locales: ['sv', 'en'] as const, withSlots: false};

  test('edits its tags as text', () => {
    const draft = {...saved, tags: tagsText(saved.tags)};

    expect(draft.tags).toEqual({sv: 'Källaren', en: 'Basement'});
    expect(checkResource(draft, saved, options, t).changed).toBe(false);
  });

  test('tags are written in every language or in none', () => {
    const {problems} = checkResource(
      {...saved, tags: {sv: 'Källaren', en: ''}},
      saved,
      options,
      t,
    );

    expect(problems).toEqual({
      'tags.en': {message: t.admin.localized.tagsInEvery, missing: true},
    });
    expect(
      hasProblems(
        checkResource({...saved, tags: {sv: ' ', en: ''}}, saved, options, t)
          .problems,
      ),
    ).toBe(false);
  });

  test('tags stay within what the server takes', () => {
    const {problems} = checkResource(
      {
        ...saved,
        tags: {sv: 'a, b, c, d, e, f', en: `${'x'.repeat(31)}, y`},
      },
      saved,
      options,
      t,
    );

    expect(problems).toEqual({
      'tags.sv': {message: t.admin.field.tooManyTags(5), missing: false},
      'tags.en': {message: t.admin.field.tagTooLong(30), missing: false},
    });
  });

  test('a new resource checks its first times too', () => {
    const {problems} = checkResource(
      {...saved, tags: {}, slots: []},
      saved,
      {...options, withSlots: true},
      t,
    );

    expect(problems).toEqual({
      slots: {message: t.admin.schedule.noSlots, missing: true},
    });
  });
});

describe('a schedule', () => {
  test('is changed by its times, and checked like a new resource', () => {
    const saved = [slot('08:00', '11:00')];

    const change = (slots: SlotInput[]) => ({slots, reason: {}});

    expect(
      checkSchedule(change([slot('08:00', '11:00')]), saved, ['sv'], t).changed,
    ).toBe(false);
    expect(
      checkSchedule(change([slot('11:00', '08:00')]), saved, ['sv'], t),
    ).toMatchObject({
      changed: true,
      problems: {slots: {missing: true}},
    });
  });

  test('sends the message to the apartments trimmed, in every language or none', () => {
    const {maxLength} = limits.ClosingBody.reason;
    const saved = [slot('08:00', '11:00')];
    const slots = [slot('09:00', '11:00')];
    const both = ['sv', 'en'] as const;

    expect(
      checkSchedule({slots, reason: {sv: '  Ny maskin  '}}, saved, ['sv'], t)
        .value.reason,
    ).toEqual({sv: 'Ny maskin'});
    expect(
      checkSchedule(
        {slots, reason: {sv: 'x'.repeat(maxLength + 1)}},
        saved,
        ['sv'],
        t,
      ).problems['reason.sv'],
    ).toMatchObject({missing: false});
    expect(checkClosing({reason: {sv: 'Trasig'}}, both, t).problems).toEqual({
      'reason.en': {message: t.admin.localized.reasonInEvery, missing: true},
    });
    expect(checkClosing({reason: {}}, both, t)).toMatchObject({
      changed: true,
      problems: {},
    });
  });

  test('takes as many slots as the server does', () => {
    const day = (count: number) =>
      Array.from({length: count}, () => slot('08:00', '09:00'));

    expect(canAddSlot(day(23))).toBe(true);
    expect(canAddSlot(day(24))).toBe(false);
  });
});

describe('the organization', () => {
  const saved = {name: 'Brf Exempel', bookingWindowDays: 30};

  test('reads the days as a number, so 030 is no change', () => {
    const checked = checkDetails({name: 'Brf Exempel', days: '030'}, saved, t);

    expect(checked.changed).toBe(false);
    expect(checked.value).toEqual(saved);
  });

  test('keeps the booking window within what the server takes', () => {
    for (const days of ['0', '366', '1.5', 'x']) {
      expect(
        checkDetails({name: 'Brf Exempel', days}, saved, t).problems.days,
      ).toEqual({
        message: t.admin.organization.windowRange(1, 365),
        missing: false,
      });
    }

    expect(checkDetails({name: '', days: ''}, saved, t).problems).toEqual({
      name: REQUIRED,
      days: REQUIRED,
    });
  });

  test('writes the rules in every language or in none', () => {
    const checked = checkRules({sv: 'Städa.', en: ''}, {}, ['sv', 'en'], t);

    expect(checked.problems).toEqual({
      'rules.en': {message: t.admin.localized.rulesInEvery, missing: true},
    });
    expect(
      hasProblems(checkRules({sv: '', en: ''}, {}, ['sv', 'en'], t).problems),
    ).toBe(false);
    expect(
      checkRules({sv: 'x'.repeat(4001)}, {}, ['sv'], t).problems['rules.sv'],
    ).toEqual(tooLong(4001, 4000));
  });
});

describe('a new password', () => {
  const draft = {current: 'old', next: 'long enough', repeat: 'long enough'};

  test('is long enough and typed twice the same', () => {
    expect(hasProblems(checkPassword(draft, t).problems)).toBe(false);
    expect(
      checkPassword({...draft, next: 'short', repeat: 'short'}, t),
    ).toMatchObject({
      problems: {
        next: {
          message: t.admin.organization.passwordTooShort(8),
          missing: true,
        },
      },
    });
    expect(
      checkPassword({...draft, repeat: 'long enougH'}, t).problems.repeat,
    ).toEqual({message: t.admin.organization.passwordsDiffer, missing: true});
  });

  test('says at once when it is too long', () => {
    const next = 'x'.repeat(129);

    expect(
      checkPassword({...draft, next, repeat: next}, t).problems.next,
    ).toEqual({
      message: t.admin.organization.passwordTooLong(128),
      missing: false,
    });
  });

  test('is a change once anything is typed', () => {
    expect(checkPassword({current: '', next: '', repeat: ''}, t).changed).toBe(
      false,
    );
    expect(checkPassword({current: 'a', next: '', repeat: ''}, t).changed).toBe(
      true,
    );
  });
});

describe('a save the server refuses', () => {
  test('tells the admin what to check', () => {
    expect(failureMessage(apiError('VALIDATION'), en)).toBe(
      en.admin.field.rejected,
    );
    expect(
      failureMessage(
        apiError('VALIDATION'),
        en,
        en.admin.apartmentForm.checkEmail,
      ),
    ).toBe('Check the email address');
    expect(failureMessage(apiError('APARTMENT_TAKEN'), en)).toBe(
      en.errors.APARTMENT_TAKEN,
    );
  });
});
