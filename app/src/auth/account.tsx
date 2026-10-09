import {useEffect, useState, type ReactNode} from 'react';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {api, unwrap} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import {signOut} from '@/auth/signOut';
import {Notice} from '@/components/Notice';
import type {components} from '@/generated/api';

export type MemberAccount = components['schemas']['MemberAccount'];
export type AdminAccount = components['schemas']['AdminAccount'];

type AccountGateProps = {
  member: (account: MemberAccount) => ReactNode;
  admin: (account: AdminAccount) => ReactNode;
};

// Asks the server who signed in and renders that kind of account's app:
// an apartment books, the admin manages the organization.
export function AccountGate({member, admin}: AccountGateProps) {
  const [account, setAccount] = useState<
    components['schemas']['Account'] | null
  >(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;

    unwrap(api.GET('/account'))
      .then((result) => {
        if (current) {
          setAccount(result);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (current) {
          setError(codeOf(caught));
        }
      });

    return () => {
      current = false;
    };
  }, [attempt]);

  if (account) {
    return account.role === 'admin' ? admin(account) : member(account);
  }

  // Signed in but no apartment answers for this account: it has moved out.
  // Retrying cannot fix that.
  if (error === 'UNAUTHORIZED') {
    return (
      <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
        <Notice
          title='Kontot saknar lägenhet'
          message='Ditt konto är inte kopplat till någon lägenhet. Kontakta styrelsen.'
          actionLabel='Logga ut'
          onAction={() => void signOut()}
        />
      </SafeAreaView>
    );
  }

  if (error !== null) {
    return (
      <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
        <Notice
          message={errorMessage(error)}
          actionLabel='Försök igen'
          onAction={() => setAttempt((previous) => previous + 1)}
        />
      </SafeAreaView>
    );
  }

  return <View className='flex-1 bg-theme-bg' />;
}
