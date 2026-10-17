import {adminActions, adminLoads} from '@brfhub/core/admin/actions';

import {api, unwrap} from '@/api/client';
import {useDialog} from '@/components/Dialog';
import {useMessages} from '@/i18n/LocaleProvider';

// What the admin screens load, bound to this client's API.
export const adminLoad = adminLoads({api, unwrap});

// onChange runs after every change, onBusy while a button's request is out.
export function useAdminActions(
  onChange?: () => void,
  onBusy?: (busy: boolean) => void,
) {
  const dialog = useDialog();
  const t = useMessages();

  return adminActions({api, unwrap, dialog, t, onChange, onBusy});
}
