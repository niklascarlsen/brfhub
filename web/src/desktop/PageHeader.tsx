import type {ReactNode} from 'react';

import {SHELL} from '@/desktop/layout';

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  children?: ReactNode;
};

export function PageHeader({eyebrow, title, children}: PageHeaderProps) {
  return (
    <div className={`${SHELL} pt-6.5`}>
      <div className='flex flex-wrap items-end justify-between gap-4 border-b border-theme-line pb-6'>
        <div className='flex min-w-0 flex-col gap-2'>
          <span className='text-[13px] text-theme-muted'>{eyebrow}</span>
          <h1 className='text-[38px] leading-tight font-semibold tracking-tight text-theme-ink'>
            {title}
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
