import type {ReactNode} from 'react';

import {useMessages} from '@/i18n/LocaleProvider';

export function Skeleton({children}: {children: ReactNode}) {
  const t = useMessages();

  return (
    <div
      role='status'
      className='animate-skeleton-pulse'
      aria-busy='true'
      aria-label={t.common.loading}
    >
      <div aria-hidden='true'>{children}</div>
    </div>
  );
}

export function SkeletonBar({className}: {className: string}) {
  return <div className={`rounded-full bg-theme-line ${className}`} />;
}
