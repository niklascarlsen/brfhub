import {Account} from '@/components/Account';
import {useConfig} from '@/config';

export function ApartmentScreen() {
  const {apartment} = useConfig();

  return (
    <div className='min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch]'>
      <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
        <h1 className='mt-4 mb-6 text-[27px] font-semibold tracking-tight text-theme-ink'>
          Lägenhet {apartment}
        </h1>
        <Account />
      </div>
    </div>
  );
}
