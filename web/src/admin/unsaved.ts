import {confirmLeave, createUnsavedForms} from '@booking/core/admin/unsaved';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';

import {useDialog} from '@/components/Dialog';
import {useMessages} from '@/i18n/LocaleProvider';

type UnsavedValue = {
  // A form says whether it holds changes that are not saved.
  mark: (form: object, dirty: boolean) => void;
  // Leaves right away and says true, or asks first while a form holds
  // unsaved changes and says false.
  confirmLeave: (leave: () => void) => boolean;
};

export const UnsavedContext = createContext<UnsavedValue | null>(null);

// What AdminShell hands to every admin screen.
export function useUnsavedRoot(): UnsavedValue {
  const t = useMessages();
  const dialog = useDialog();
  const [forms] = useState(createUnsavedForms);

  // Closing the tab or reloading cannot be asked about in our own dialog,
  // so the browser asks in its own words.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (forms.any()) {
        event.preventDefault();
      }
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [forms]);

  return useMemo(
    () => ({
      mark: forms.mark,
      confirmLeave: (leave) => confirmLeave(forms, leave, dialog, t),
    }),
    [forms, dialog, t],
  );
}

function useValue(): UnsavedValue {
  const value = useContext(UnsavedContext);

  if (value === null) {
    throw new Error('Admin screens must be used inside AdminShell');
  }

  return value;
}

// Only one admin page is mounted at a time, so every form mounted counts.
export function useUnsavedChanges(dirty: boolean) {
  const {mark} = useValue();
  const [form] = useState(() => ({}));

  useEffect(() => {
    mark(form, dirty);

    return () => mark(form, false);
  }, [mark, form, dirty]);
}

export function useConfirmLeave(): (leave: () => void) => boolean {
  return useValue().confirmLeave;
}
