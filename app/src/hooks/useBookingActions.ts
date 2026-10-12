import {bookingActions} from '@booking/core/booking/bookingActions';

import {api, unwrap} from '@/api/client';
import {useDialog} from '@/components/Dialog';
import {useMessages} from '@/i18n/LocaleProvider';

export function useBookingActions(onChange?: () => void) {
  const dialog = useDialog();
  const t = useMessages();

  return bookingActions({api, unwrap, dialog, t, onChange});
}
