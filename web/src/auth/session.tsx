import type {ReactNode} from 'react';

import {errorMessage} from '@/api/errors';
import {authClient} from '@/auth/client';
import {Notice} from '@/components/Notice';
import {LoginScreen} from '@/screens/LoginScreen';

function Blank({children}: {children: ReactNode}) {
  return <div className='flex min-h-svh flex-col bg-theme-bg'>{children}</div>;
}

// Everything below only renders with a live session, so a sign-out or an
// expired session unmounts the app state along with it.
export function SessionGate({children}: {children: ReactNode}) {
  const {data: session, isPending, error, refetch} = authClient.useSession();

  if (session) {
    return children;
  }

  if (isPending) {
    return <Blank>{null}</Blank>;
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
