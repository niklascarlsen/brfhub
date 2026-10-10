import {useEffect, useState, type ReactNode} from 'react';

import {api, unwrap} from '@/api/client';
import {codeOf, errorMessage, type ClientErrorCode} from '@/api/errors';
import {signOut} from '@/auth/signOut';
import {Blank} from '@/components/Blank';
import {Notice} from '@/components/Notice';
import type {components} from '@/generated/api';
import {useMessages} from '@/i18n/LocaleProvider';
import {useReturnToTab} from '@/hooks/useReturnToTab';

export type MemberAccount = components['schemas']['MemberAccount'];
export type AdminAccount = components['schemas']['AdminAccount'];

type AccountGateProps = {
  member: (account: MemberAccount) => ReactNode;
  admin: (account: AdminAccount, refresh: () => void) => ReactNode;
};

// Asks the server who signed in and renders that kind of account's app:
// an apartment books, the admin manages the organization.
export function AccountGate({member, admin}: AccountGateProps) {
  const t = useMessages();
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
          const code = codeOf(caught);
          setError(code);

          // The apartment has moved out since the last answer: stop
          // showing its app. Other failures keep the account shown.
          if (code === 'UNAUTHORIZED') {
            setAccount(null);
          }
        }
      });

    return () => {
      current = false;
    };
  }, [attempt]);

  const refresh = () => setAttempt((previous) => previous + 1);

  // Asked again whenever the tab returns, so a renamed organization or a
  // moved-out apartment shows without a reload.
  useReturnToTab(refresh);

  // A refresh keeps showing the account it has until the new one arrives.
  if (account) {
    return account.role === 'admin' ? admin(account, refresh) : member(account);
  }

  // Signed in but no apartment answers for this account: it has moved out.
  // Retrying cannot fix that.
  if (error === 'UNAUTHORIZED') {
    return (
      <Blank>
        <Notice
          title={t.account.noApartmentTitle}
          message={t.account.noApartmentMessage}
          actionLabel={t.account.signOut}
          onAction={() => void signOut()}
        />
      </Blank>
    );
  }

  if (error !== null) {
    return (
      <Blank>
        <Notice
          message={errorMessage(error, t)}
          actionLabel={t.common.retry}
          onAction={refresh}
        />
      </Blank>
    );
  }

  return <Blank />;
}
