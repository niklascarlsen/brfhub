import type {Apartment} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {useState} from 'react';

import {ApartmentForm} from '@/admin/ApartmentForm';
import {CARD, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {ChevronForwardIcon} from '@/components/icons';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useMessages} from '@/i18n/LocaleProvider';

type ApartmentDetailProps = {
  apartment: Apartment;
  // After every change, and after a failure that means the apartment
  // shown is out of date.
  onChanged: () => void;
  onRemoved: () => void;
};

function Row({label, value}: {label: string; value: string}) {
  return (
    <div className='flex items-baseline justify-between gap-4 py-2.5'>
      <span className='shrink-0 text-[13px] text-theme-muted'>{label}</span>
      <span className='min-w-0 truncate text-right text-sm text-theme-ink'>
        {value}
      </span>
    </div>
  );
}

function Action({
  label,
  description,
  disabled = false,
  onPress,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onPress}
      disabled={disabled}
      className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
    >
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {label}
        </span>
        <span className='text-[13px] leading-5 text-theme-muted'>
          {description}
        </span>
      </span>
      <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
    </button>
  );
}

type Mode = 'view' | 'edit' | 'new-resident';

export function ApartmentDetail({
  apartment,
  onChanged,
  onRemoved,
}: ApartmentDetailProps) {
  const t = useMessages();
  const [mode, setMode] = useState<Mode>('view');
  // A second tap while a request runs would reset twice or remove twice.
  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(onChanged, setBusy);

  if (mode === 'edit') {
    return (
      <ApartmentForm
        initial={{
          label: apartment.label,
          residentName: apartment.residentName,
          email: apartment.email,
        }}
        withLabel
        note={t.admin.apartment.editNote}
        submitLabel={t.admin.save}
        onCancel={() => setMode('view')}
        onSubmit={async (fields) => {
          await actions.apartments.update(apartment.id, fields);
          setMode('view');
        }}
      />
    );
  }

  if (mode === 'new-resident') {
    return (
      <ApartmentForm
        initial={{label: apartment.label, residentName: '', email: ''}}
        withLabel={false}
        note={t.admin.apartment.newResidentNote(
          t.admin.apartment.cancelNote(apartment.upcomingBookings),
        )}
        submitLabel={t.admin.apartment.replaceResident}
        onCancel={() => setMode('view')}
        onSubmit={async (fields) => {
          await actions.apartments.newResident(apartment.id, fields);
          setMode('view');
        }}
      />
    );
  }

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
          <Row
            label={t.admin.apartment.resident}
            value={apartment.residentName}
          />
          <Row label={t.common.email} value={apartment.email} />
          <Row label={t.admin.apartment.lastSignIn} value={signedIn} />
          <Row
            label={t.admin.apartment.upcomingBookings}
            value={String(apartment.upcomingBookings)}
          />
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.actions}</h2>
        <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label={t.admin.editDetails}
            description={t.admin.apartment.editDetailsHint}
            onPress={() => setMode('edit')}
          />
          <Action
            label={t.admin.apartment.signOut}
            description={t.admin.apartment.signOutHint}
            disabled={busy}
            onPress={() => actions.apartments.confirmSignOut(apartment)}
          />
          <Action
            label={t.admin.apartment.newResident}
            description={t.admin.apartment.newResidentHint}
            onPress={() => setMode('new-resident')}
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
