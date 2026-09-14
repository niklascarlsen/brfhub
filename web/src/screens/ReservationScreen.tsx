import {signOut} from '@/auth/signOut';
import {MyTimes} from '@/components/MyTimes';
import {useConfig} from '@/config';

export function ReservationScreen() {
  const {apartment} = useConfig();

  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]'>
      <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Mina tider
        </h1>
        <MyTimes />
        <div className='mt-auto flex items-center justify-between pt-8 text-[13px] text-theme-muted'>
          <span>Lägenhet {apartment}</span>
          <button
            type='button'
            onClick={() => void signOut()}
            className='font-semibold text-theme-accent transition-opacity hover:opacity-70 active:opacity-60'
          >
            Logga ut
          </button>
        </div>
      </div>
    </div>
  );
}
