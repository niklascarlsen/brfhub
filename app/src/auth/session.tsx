import type {ReactNode} from 'react';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Blank} from '@/components/Blank';
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
    return <Blank />;
  }

  if (error) {
    return (
      <Blank>
        <Notice
          message={errorMessage('NETWORK')}
          actionLabel='Försök igen'
          onAction={() => void refetch()}
        />
      </Blank>
    );
  }

  return <LoginScreen />;
}
