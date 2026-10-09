import type {ReactNode} from 'react';

import {ChevronBackIcon} from '@/components/icons';
import {SHELL} from '@/desktop/layout';
import {PageHeader} from '@/desktop/PageHeader';
import {useIsDesktop} from '@/lib/media';

type AdminPageProps = {
  title: string;
  subtitle: string;
  back?: {label: string; onPress: () => void};
  action?: ReactNode;
  children: ReactNode;
};

// One admin page: a back link when it is a step down, the title, an
// optional action beside it, and the content in a readable column.
export function AdminPage({
  title,
  subtitle,
  back,
  action,
  children,
}: AdminPageProps) {
  const isDesktop = useIsDesktop();

  const backLink = back ? (
    <button
      type='button'
      onClick={back.onPress}
      className='-ml-1 flex items-center gap-1 self-start rounded-lg py-1 pr-2 text-sm font-semibold text-theme-muted transition-colors hover:text-theme-ink'
    >
      <ChevronBackIcon size={16} />
      {back.label}
    </button>
  ) : null;

  if (isDesktop) {
    return (
      <>
        {backLink ? <div className={`${SHELL} pt-5`}>{backLink}</div> : null}
        <PageHeader eyebrow={subtitle} title={title}>
          {action}
        </PageHeader>
        <div className={`${SHELL} pt-7 pb-12`}>
          <div className='flex max-w-2xl flex-col'>{children}</div>
        </div>
      </>
    );
  }

  return (
    <div className='flex min-h-full flex-col px-5 pt-2 pb-8'>
      {backLink ? <div className='mt-2'>{backLink}</div> : null}
      <h1 className='mt-4 text-[27px] font-semibold tracking-tight text-theme-ink'>
        {title}
      </h1>
      <p className='mt-1 mb-6 text-[13px] text-theme-muted'>{subtitle}</p>
      {action ? <div className='mb-6 flex flex-col'>{action}</div> : null}
      {children}
    </div>
  );
}
