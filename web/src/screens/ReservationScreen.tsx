import {MyTimes} from '@/components/MyTimes';

export function ReservationScreen() {
  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]'>
      <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Mina tider
        </h1>
        <MyTimes />
      </div>
    </div>
  );
}
