import {errorMessage} from '@brfhub/core/api/errors';
import type {MemberAccount} from '@brfhub/core/auth/account';
import {
  ConfigContext,
  configView,
  fetchConfig,
} from '@brfhub/core/config/config';
import {useLoad} from '@brfhub/core/load/useLoad';
import {useEffect, type ReactNode} from 'react';

import {api, unwrap} from '@/api/client';
import {Blank} from '@/components/Blank';
import {Notice} from '@/components/Notice';
import {useOnReturn} from '@/hooks/useOnReturn';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

type ConfigProviderProps = {
  account: MemberAccount;
  children: ReactNode;
};

export function ConfigProvider({account, children}: ConfigProviderProps) {
  const t = useMessages();
  // The resources are named in the language shown, so a new one loads
  // them again.
  const {locale} = useLocale();
  const {data, error, reload} = useLoad(() => fetchConfig({api, unwrap}));

  useEffect(reload, [reload, locale]);
  useOnReturn(reload);

  const view = configView(data, error, account);

  switch (view.kind) {
    case 'ready':
      return (
        <ConfigContext.Provider value={view.config}>
          {children}
        </ConfigContext.Provider>
      );
    case 'empty':
      return (
        <Blank>
          <Notice
            title={t.account.nothingToBookTitle}
            message={t.account.nothingToBookMessage}
            actionLabel={t.common.retry}
            onAction={reload}
          />
        </Blank>
      );
    case 'failed':
      return (
        <Blank>
          <Notice
            message={errorMessage(view.error, t)}
            actionLabel={t.common.retry}
            onAction={reload}
          />
        </Blank>
      );
    case 'waiting':
      return <Blank />;
  }
}
