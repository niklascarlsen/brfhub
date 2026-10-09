import {useEffect} from 'react';

import type {AdminAccount} from '@/auth/account';
import {authClient} from '@/auth/client';
import {Account} from '@/components/Account';
import {HomeOutlineIcon} from '@/components/icons';
import {SHELL} from '@/desktop/layout';
import {PageHeader} from '@/desktop/PageHeader';
import {useIsDesktop} from '@/lib/media';

const ADMIN_PATH = '/admin';

async function signOutAdmin() {
  await authClient.signOut();
}

function Upcoming() {
  return (
    <section aria-labelledby='upcoming-heading'>
      <h2
        id='upcoming-heading'
        className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'
      >
        Föreningen
      </h2>
      <div className='rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-4'>
        <p className='text-[13px] leading-5 text-theme-ink'>
          Här kommer du att lägga till lägenheter och ställa in resurser, tider,
          regler och anslag.
        </p>
      </div>
    </section>
  );
}

// The admin's app. It books nothing, so none of the booking screens, push or
// their routes are mounted here.
export function AdminShell({account}: {account: AdminAccount}) {
  const isDesktop = useIsDesktop();
  const {organizationName} = account;

  useEffect(() => {
    document.title = 'Admin';

    if (window.location.pathname !== ADMIN_PATH) {
      window.history.replaceState(null, '', ADMIN_PATH);
    }
  }, []);

  const accountCard = (
    <Account signOutFrom={organizationName} onSignOut={signOutAdmin} />
  );

  if (isDesktop) {
    return (
      <div className='flex min-h-dvh flex-col bg-theme-bg'>
        <header className={`${SHELL} flex shrink-0 items-center pt-5.5`}>
          <span className='flex items-center gap-2.5 py-1 pr-2 text-theme-ink'>
            <span className='flex h-8 w-8 items-center justify-center rounded-[10px] bg-theme-ink text-theme-surface'>
              <HomeOutlineIcon size={17} />
            </span>
            <span className='text-[15px] font-semibold tracking-tight'>
              {organizationName}
            </span>
          </span>
        </header>
        <main className='flex grow flex-col'>
          <PageHeader eyebrow={organizationName} title='Administration' />
          <div className={`${SHELL} pt-7 pb-12`}>
            <div className='flex max-w-xl flex-col'>
              {accountCard}
              <Upcoming />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className='flex min-h-dvh flex-col bg-theme-bg pt-[env(safe-area-inset-top)]'>
      <main className='flex flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Administration
        </h1>
        <p className='mt-1 mb-6 text-[13px] text-theme-muted'>
          {organizationName}
        </p>
        {accountCard}
        <Upcoming />
      </main>
    </div>
  );
}
