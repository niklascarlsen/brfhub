import {useEffect, useState} from 'react';

import {useDialog} from '@/components/Dialog';
import {useOnReturn} from '@/hooks/useOnReturn';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import {
  dropPushSubscription,
  enablePush,
  isSupported,
  pushPermission,
} from '@/lib/push';
import {readPushEnabled, savePushEnabled} from '@/lib/pushPreference';

async function isOn(): Promise<boolean> {
  return (await readPushEnabled()) && pushPermission() === 'granted';
}

// Push in this browser, under the account. Off drops the subscription; on
// subscribes again, asking the browser when it has not been asked. Once
// the browser has been told no, only its settings can say yes. Hidden
// where the browser cannot push at all.
export function PushToggle() {
  const t = useMessages();
  const dialog = useDialog();
  const {locale} = useLocale();
  // Null until the preference has answered.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;

    void isOn().then((on) => {
      if (current) {
        setEnabled(on);
      }
    });

    return () => {
      current = false;
    };
  }, []);

  // Back from the browser's settings, where a browser that has been told
  // no can only be told yes: allowed there, it subscribes at once instead
  // of at the next load.
  useOnReturn(() => {
    if (!isSupported() || enabled !== false || busy) {
      return;
    }

    // Busy until done, so the switch cannot be turned off meanwhile and
    // then be turned back on when this finishes.
    setBusy(true);
    isOn()
      .then(async (on) => {
        if (on) {
          await enablePush(locale);
          setEnabled(true);
        }
      })
      .catch((error: unknown) => {
        console.warn('[push] could not subscribe', error);
      })
      .finally(() => setBusy(false));
  });

  if (!isSupported()) {
    return null;
  }

  const change = async (next: boolean) => {
    setBusy(true);

    try {
      if (!next) {
        await savePushEnabled(false);
        await dropPushSubscription();
        setEnabled(false);
        return;
      }

      // The wish is kept, so allowing push in the settings turns it on.
      await savePushEnabled(true);

      if (pushPermission() === 'blocked') {
        dialog.alert(t.push.blockedTitle, t.push.failedMessage);
        return;
      }

      await enablePush(locale);
      setEnabled(true);
    } catch {
      dialog.alert(t.push.failedTitle, t.push.failedMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='mt-2.5 flex items-center gap-3.5 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-4'>
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <span className='text-sm font-semibold text-theme-ink'>
          {t.push.toggle}
        </span>
        <span className='text-[13px] leading-4.5 text-theme-muted'>
          {t.push.toggleHint}
        </span>
      </div>
      <button
        type='button'
        role='switch'
        aria-checked={enabled === true}
        aria-label={t.push.toggle}
        disabled={enabled === null || busy}
        onClick={() => void change(!(enabled === true))}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? 'bg-theme-ink' : 'bg-theme-line'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-theme-surface shadow transition-transform ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}
