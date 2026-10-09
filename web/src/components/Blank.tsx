import type {ReactNode} from 'react';

// The bare page the gates show while they load or when they fail.
export function Blank({children}: {children?: ReactNode}) {
  return <div className='flex min-h-svh flex-col bg-theme-bg'>{children}</div>;
}
