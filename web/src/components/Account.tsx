import {authClient} from '@/auth/client';
import {signOut} from '@/auth/signOut';
import {useDialog} from '@/components/Dialog';
import {useConfig} from '@/config';

export function Account() {
  const {data: session} = authClient.useSession();
  const {apartment} = useConfig();
  const dialog = useDialog();

  const confirmSignOut = () =>
    dialog.confirm('Logga ut', `Vill du logga ut från lägenhet ${apartment}?`, {
      label: 'Logga ut',
      onPress: () => {
        void signOut();
      },
    });

  return (
    <div className='mb-6.5'>
      <p className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
        Konto
      </p>
      <div className='flex items-center gap-3.5 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-4'>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <span className='text-sm font-semibold text-theme-muted'>
            Inloggad som
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
          Logga ut
        </button>
      </div>
    </div>
  );
}
