import type {ReactNode} from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Notice} from '@/components/Notice';
import {LoginScreen} from '@/screens/LoginScreen';

// Everything below only renders with a live session, so a sign-out or an
// expired session unmounts the app state along with it.
export function SessionGate({children}: {children: ReactNode}) {
  const {data: session, isPending, error, refetch} = authClient.useSession();

  if (session) {
    return children;
  }

  if (isPending) {
    return <View className='flex-1 bg-theme-bg' />;
  }

  if (error) {
    return (
      <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
        <Notice
          message={errorMessage('NETWORK')}
          actionLabel='Försök igen'
          onAction={() => void refetch()}
        />
      </SafeAreaView>
    );
  }

  return <LoginScreen />;
}
