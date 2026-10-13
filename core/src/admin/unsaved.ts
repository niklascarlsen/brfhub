import type {Messages} from '../i18n/catalog';
import type {Dialog} from '../lib/dialog';

// The admin forms shown that hold changes not yet saved. Each client keeps
// one for the admin's screens and marks its forms in it.
export type UnsavedForms = {
  mark: (form: object, dirty: boolean) => void;
  any: () => boolean;
};

export function createUnsavedForms(): UnsavedForms {
  const dirty = new Set<object>();

  return {
    mark: (form, isDirty) => {
      if (isDirty) {
        dirty.add(form);
      } else {
        dirty.delete(form);
      }
    },
    any: () => dirty.size > 0,
  };
}

// Leaves right away and says true, or asks first while a form holds
// unsaved changes and says false.
export function confirmLeave(
  forms: UnsavedForms,
  leave: () => void,
  dialog: Dialog,
  t: Messages,
): boolean {
  if (!forms.any()) {
    leave();
    return true;
  }

  dialog.confirm(t.admin.unsaved.title, t.admin.unsaved.message, {
    label: t.admin.unsaved.leave,
    destructive: true,
    onPress: leave,
    cancelLabel: t.admin.unsaved.stay,
  });

  return false;
}
