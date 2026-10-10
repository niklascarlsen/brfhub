import {useIsFocused} from '@react-navigation/native';
import {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {Alert} from 'react-native';

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
  const [dirty] = useState(() => new Set<object>());

  return useMemo(
    () => ({
      mark: (form, isDirty) => {
        if (isDirty) {
          dirty.add(form);
        } else {
          dirty.delete(form);
        }
      },
      confirmLeave: (leave) => {
        if (dirty.size === 0) {
          leave();
          return true;
        }

        Alert.alert(t.admin.unsaved.title, t.admin.unsaved.message, [
          {text: t.admin.unsaved.stay, style: 'cancel'},
          {text: t.admin.unsaved.leave, style: 'destructive', onPress: leave},
        ]);

        return false;
      },
    }),
    [dirty, t],
  );
}

function useValue(): UnsavedValue {
  const value = useContext(UnsavedContext);

  if (value === null) {
    throw new Error('Admin screens must be used inside AdminShell');
  }

  return value;
}

// Every tab keeps its screen, so only the form in the tab shown counts:
// a form left half done in another tab is still there when it returns.
export function useUnsavedChanges(dirty: boolean) {
  const {mark} = useValue();
  const focused = useIsFocused();
  const [form] = useState(() => ({}));

  useEffect(() => {
    mark(form, dirty && focused);

    return () => mark(form, false);
  }, [mark, form, dirty, focused]);
}

export function useConfirmLeave(): (leave: () => void) => boolean {
  return useValue().confirmLeave;
}
