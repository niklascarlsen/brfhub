import {describe, expect, test, vi} from 'vitest';

import {sv as t} from '../i18n/sv';
import type {Dialog} from '../lib/dialog';
import {confirmLeave, createUnsavedForms} from './unsaved';

function setup() {
  const dialog: Dialog = {alert: vi.fn(), confirm: vi.fn(), choose: vi.fn()};
  const leave = vi.fn();

  return {forms: createUnsavedForms(), dialog, leave};
}

describe('leaving an admin screen', () => {
  test('leaves at once when no form holds changes', () => {
    const {forms, dialog, leave} = setup();

    expect(confirmLeave(forms, leave, dialog, t)).toBe(true);
    expect(leave).toHaveBeenCalledOnce();
    expect(dialog.confirm).not.toHaveBeenCalled();
  });

  test('asks first while a form holds changes, and leaves on yes', () => {
    const {forms, dialog, leave} = setup();
    forms.mark({}, true);

    expect(confirmLeave(forms, leave, dialog, t)).toBe(false);
    expect(leave).not.toHaveBeenCalled();
    expect(dialog.confirm).toHaveBeenCalledWith(
      t.admin.unsaved.title,
      t.admin.unsaved.message,
      {
        label: t.admin.unsaved.leave,
        destructive: true,
        onPress: leave,
        cancelLabel: t.admin.unsaved.stay,
      },
    );
  });

  test('counts each form once, until it is saved or goes', () => {
    const {forms} = setup();
    const first = {};
    const second = {};

    forms.mark(first, true);
    forms.mark(first, true);
    forms.mark(second, true);
    forms.mark(first, false);
    expect(forms.any()).toBe(true);

    forms.mark(second, false);
    expect(forms.any()).toBe(false);
  });
});
