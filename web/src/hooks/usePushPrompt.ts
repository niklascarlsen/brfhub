// Asks once per browser whether to turn on push, after the service worker
// is ready. The browser prompt itself opens from the dialog button so it
// counts as a user gesture. The app asks through the OS prompt instead.
import {useEffect} from 'react';

import {useDialog} from '@/components/Dialog';
import {useMessages} from '@/i18n/LocaleProvider';
import {
  enablePush,
  markPushPromptShown,
  syncPushSubscription,
} from '@/lib/push';

export function usePushPrompt() {
  const dialog = useDialog();
  const t = useMessages();

  useEffect(() => {
    let current = true;

    void syncPushSubscription()
      .then((missing) => {
        if (!current || !missing) {
          return;
        }

        markPushPromptShown();

        dialog.confirm(t.push.promptTitle, t.push.promptMessage, {
          label: t.push.turnOn,
          onPress: () => {
            enablePush().catch(() => {
              dialog.alert(t.push.failedTitle, t.push.failedMessage);
            });
          },
        });
      })
      .catch(() => {});

    return () => {
      current = false;
    };
  }, [dialog, t]);
}
