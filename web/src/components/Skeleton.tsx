import type {ReactNode} from 'react';

export function Skeleton({children}: {children: ReactNode}) {
  return (
    <div
      role='status'
      className='animate-skeleton-pulse'
      aria-busy='true'
      aria-label='Laddar'
    >
      <div aria-hidden='true'>{children}</div>
    </div>
  );
}

export function SkeletonBar({className}: {className: string}) {
  return <div className={`rounded-full bg-theme-line ${className}`} />;
}
