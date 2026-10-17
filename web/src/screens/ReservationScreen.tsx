import {MyTimes} from '@/components/MyTimes';
import {useMessages} from '@/i18n/LocaleProvider';

export function ReservationScreen() {
  const t = useMessages();

  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth pb-[var(--tab-bar-clearance,0px)] [-webkit-overflow-scrolling:touch]'>
      <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          {t.tabs.myTimes}
        </h1>
        <MyTimes />
      </div>
    </div>
  );
}
