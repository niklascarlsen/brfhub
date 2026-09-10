// Asks once per browser whether to turn on push, after the service worker
// is ready. The browser prompt itself opens from the dialog button so it
// counts as a user gesture. The app asks through the OS prompt instead.
import {useEffect} from 'react';

import {useDialog} from '@/components/Dialog';
import {
  enablePush,
  markPushPromptShown,
  syncPushSubscription,
} from '@/lib/push';

export function usePushPrompt() {
  const dialog = useDialog();

  useEffect(() => {
    let current = true;

    void syncPushSubscription()
      .then((missing) => {
        if (!current || !missing) {
          return;
        }

        markPushPromptShown();

        dialog.confirm(
          'Notiser',
          'Vill du få en notis när en tid du köar för blir ledig?',
          {
            label: 'Slå på',
            onPress: () => {
              enablePush().catch(() => {
                dialog.alert(
                  'Kunde inte slå på notiser',
                  'Tillåt notiser för den här appen i webbläsarens inställningar.',
                );
              });
            },
          },
        );
      })
      .catch(() => {});

    return () => {
      current = false;
    };
  }, [dialog]);
}
