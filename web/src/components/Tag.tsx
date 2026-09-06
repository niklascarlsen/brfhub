export function Tag({label}: {label: string}) {
  return (
    <span className='self-start rounded-full bg-theme-mist px-2.25 py-1 text-[10px] font-bold tracking-[0.5px] text-theme-accent uppercase'>
      {label}
    </span>
  );
}
