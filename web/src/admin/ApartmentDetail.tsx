import type {Apartment} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {useState} from 'react';

import {ActionRow, DetailRow} from '@/admin/Rows';
import {CARD, LIST, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useMessages} from '@/i18n/LocaleProvider';

type ApartmentDetailProps = {
  apartment: Apartment;
  // After every change, and after a failure that means the apartment
  // shown is out of date.
  onChanged: () => void;
  onRemoved: () => void;
  onEdit: () => void;
  onNewResident: () => void;
};

export function ApartmentDetail({
  apartment,
  onChanged,
  onRemoved,
  onEdit,
  onNewResident,
}: ApartmentDetailProps) {
  const t = useMessages();
  // A second tap while a request runs would reset twice or remove twice.
  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(onChanged, setBusy);

  const signedIn = apartment.lastSignInOn
    ? formatLongDate(apartment.lastSignInOn, t)
    : t.admin.apartment.never;

  return (
    <div className='flex flex-col gap-6.5'>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.details}</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <DetailRow
            label={t.admin.apartment.resident}
            value={apartment.residentName}
          />
          <DetailRow label={t.common.email} value={apartment.email} />
          <DetailRow label={t.admin.apartment.lastSignIn} value={signedIn} />
          <DetailRow
            label={t.admin.apartment.upcomingBookings}
            value={String(apartment.upcomingBookings)}
          />
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.actions}</h2>
        <div className={LIST}>
          <ActionRow
            label={t.admin.editDetails}
            description={t.admin.apartment.editDetailsHint}
            onPress={onEdit}
          />
          <ActionRow
            label={t.admin.apartment.signOut}
            description={t.admin.apartment.signOutHint}
            disabled={busy}
            onPress={() => actions.apartments.confirmSignOut(apartment)}
          />
          <ActionRow
            label={t.admin.apartment.newResident}
            description={t.admin.apartment.newResidentHint}
            onPress={onNewResident}
          />
        </div>
      </section>
      <button
        type='button'
        onClick={() => actions.apartments.confirmRemove(apartment, onRemoved)}
        disabled={busy}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        {t.admin.apartment.remove}
      </button>
    </div>
  );
}
