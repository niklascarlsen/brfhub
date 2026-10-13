import {errorMessage} from '@booking/core/api/errors';
import {
  accountView,
  forgetsAccount,
  type AdminAccount,
  type MemberAccount,
  type Mode,
} from '@booking/core/auth/account';
import {useLoad} from '@booking/core/load/useLoad';
import {useEffect, type ReactNode} from 'react';

import {api, unwrap} from '@/api/client';
import {signOut} from '@/auth/signOut';
import {Blank} from '@/components/Blank';
import {Notice} from '@/components/Notice';
import {useOnReturn} from '@/hooks/useOnReturn';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

type AccountGateProps = {
  // Which app an account with both is shown. Null shows the apartment's.
  mode: Mode | null;
  member: (account: MemberAccount) => ReactNode;
  admin: (account: AdminAccount, refresh: () => void) => ReactNode;
  // An admin without an authenticator yet sets one up, then refreshes.
  twoFactorSetup: (account: AdminAccount, refresh: () => void) => ReactNode;
};

// Asks the server who signed in and renders that kind of account's app:
// an apartment books, an admin manages the organization, and an account
// that is both is shown the mode asked for.
export function AccountGate({
  mode,
  member,
  admin,
  twoFactorSetup,
}: AccountGateProps) {
  const t = useMessages();
  const {setOrganizationLocales} = useLocale();
  const {
    data,
    error,
    reload: refresh,
  } = useLoad(() => unwrap(api.GET('/account')), {
    forgets: forgetsAccount,
    // In the same update as the account, so its app never shows in a
    // language the organization does not use.
    onSettle: (state) => setOrganizationLocales(state.data?.locales ?? null),
  });

  useEffect(refresh, [refresh]);

  // Signed out: the sign-in screen may show any language again.
  useEffect(() => () => setOrganizationLocales(null), [setOrganizationLocales]);

  // Asked again whenever the user comes back, so a renamed organization or
  // a moved-out apartment shows without a restart.
  useOnReturn(refresh);

  const view = accountView(data, error, mode);

  switch (view.kind) {
    case 'member':
      return member(view.account);
    case 'admin':
      return admin(view.account, refresh);
    case 'two-factor-setup':
      return twoFactorSetup(view.account, refresh);
    case 'moved-out':
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
    case 'failed':
      return (
        <Blank>
          <Notice
            message={errorMessage(view.error, t)}
            actionLabel={t.common.retry}
            onAction={refresh}
          />
        </Blank>
      );
    case 'waiting':
      return <Blank />;
  }
}
