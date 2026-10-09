import {HomeOutlineIcon} from '@/components/icons';

// The organization's name with the house mark, top left on every desktop
// page.
export function OrganizationMark({name}: {name: string}) {
  return (
    <>
      <span className='flex h-8 w-8 items-center justify-center rounded-[10px] bg-theme-ink text-theme-surface'>
        <HomeOutlineIcon size={17} />
      </span>
      <span className='text-[15px] font-semibold tracking-tight'>{name}</span>
    </>
  );
}
