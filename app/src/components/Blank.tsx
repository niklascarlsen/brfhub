import type {ReactNode} from 'react';
import {SafeAreaView} from 'react-native-safe-area-context';

// The bare screen the gates show while they load or when they fail.
export function Blank({children}: {children?: ReactNode}) {
  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      {children}
    </SafeAreaView>
  );
}
