import type {ReactNode} from 'react';

import {authClient} from '@/auth/client';
import {useDialog} from '@/components/Dialog';
import {ChevronForwardIcon} from '@/components/icons';
import {LanguagePicker} from '@/components/LanguagePicker';
import {useMessages} from '@/i18n/LocaleProvider';
import {linkProps, type Route} from '@/lib/route';

type AccountProps = {
  // Completes the sign-out question, such as "lägenhet 12".
  signOutFrom: string;
  onSignOut: () => Promise<void>;
  // The account's other app, for one that both books and manages.
  switchTo: {label: string; route: Route; onPress: () => void} | null;
  // Shown under the card, such as the apartment's push switch.
  children?: ReactNode;
};

export function Account({
  signOutFrom,
  onSignOut,
  switchTo,
  children,
}: AccountProps) {
  const {data: session} = authClient.useSession();
  const dialog = useDialog();
  const t = useMessages();

  const confirmSignOut = () =>
    dialog.confirm(t.account.signOut, t.account.signOutQuestion(signOutFrom), {
      label: t.account.signOut,
      onPress: () => {
        void onSignOut();
      },
    });

  return (
    <>
      <div className='mb-6.5'>
        <p className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
          {t.account.heading}
        </p>
        <div className='flex items-center gap-3.5 rounded-card border border-theme-line bg-theme-surface px-4.5 py-4'>
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <span className='text-sm font-semibold text-theme-muted'>
              {t.account.signedInAs}
            </span>
            <span className='truncate text-[17px] font-semibold tracking-tight text-theme-ink'>
              {session?.user.email}
            </span>
          </div>
          <button
            type='button'
            onClick={confirmSignOut}
            className='h-11 shrink-0 rounded-full border border-theme-edge bg-theme-surface px-5 text-sm font-semibold tracking-tight text-theme-ink transition-colors hover:bg-theme-sunk active:opacity-70'
          >
            {t.account.signOut}
          </button>
        </div>
        {switchTo ? (
          <a
            {...linkProps(switchTo.route, switchTo.onPress)}
            className='mt-2.5 flex h-12 items-center justify-center gap-2 rounded-card border border-theme-line bg-theme-surface px-4.5 text-sm font-semibold tracking-tight text-theme-ink transition-colors hover:bg-theme-sunk active:opacity-70'
          >
            {switchTo.label}
            <ChevronForwardIcon size={16} className='text-theme-faint' />
          </a>
        ) : null}
        {children}
      </div>
      <LanguagePicker />
    </>
  );
}
