import type {Dialog} from '@booking/core/lib/dialog';
import {useMemo} from 'react';
import {Alert} from 'react-native';

import {useMessages} from '@/i18n/LocaleProvider';

// The platform's own alert, in the same shape as the web's dialog.
export function useDialog(): Dialog {
  const t = useMessages();

  return useMemo<Dialog>(
    () => ({
      alert: (title, message) => Alert.alert(title, message),
      confirm: (title, message, action) =>
        Alert.alert(title, message, [
          {text: action.cancelLabel ?? t.common.cancel, style: 'cancel'},
          action.destructive
            ? {
                text: action.label,
                style: 'destructive',
                onPress: action.onPress,
              }
            : {text: action.label, isPreferred: true, onPress: action.onPress},
        ]),
    }),
    [t],
  );
}
