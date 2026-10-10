import {useState} from 'react';

import {ApartmentForm} from '@/admin/ApartmentForm';
import {CARD, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap, type Apartment} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {useDialog} from '@/components/Dialog';
import {ChevronForwardIcon} from '@/components/icons';
import type {Messages} from '@/i18n/catalog';
import {useMessages} from '@/i18n/LocaleProvider';
import {formatLongDate} from '@/lib/dates';

type ApartmentDetailProps = {
  apartment: Apartment;
  onChanged: () => void;
  onPassword: (apartment: Apartment, password: string) => void;
  onRemoved: () => void;
};

// What the admin is told before anything that cancels the apartment's
// bookings, since those are times someone else is counting on.
function cancelNote(apartment: Apartment, t: Messages): string {
  return t.admin.apartment.cancelNote(apartment.upcomingBookings);
}

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
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onPress}
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
  onPassword,
  onRemoved,
}: ApartmentDetailProps) {
  const dialog = useDialog();
  const t = useMessages();
  const [mode, setMode] = useState<Mode>('view');
  // A second tap while a request runs would reset twice or remove twice.
  const [busy, setBusy] = useState(false);

  const run = (request: Promise<void>, failTitle: string) => {
    setBusy(true);
    request.catch(fail(failTitle)).finally(() => setBusy(false));
  };

  const fail = (title: string) => (caught: unknown) =>
    dialog.alert(title, errorMessage(codeOf(caught), t));

  const resetPassword = () =>
    dialog.confirm(
      t.admin.apartment.resetPassword,
      t.admin.apartment.resetQuestion(apartment.label),
      {
        label: t.admin.apartment.reset,
        onPress: () => {
          if (busy) {
            return;
          }
          run(
            unwrap(
              api.POST('/admin/apartments/{id}/reset-password', {
                params: {path: {id: apartment.id}},
              }),
            ).then(({password}) => onPassword(apartment, password)),
            t.admin.apartment.resetFailed,
          );
        },
      },
    );

  const remove = () =>
    dialog.confirm(
      t.admin.apartment.remove,
      t.admin.apartment.removeQuestion(cancelNote(apartment, t)),
      {
        label: t.admin.remove,
        onPress: () => {
          if (busy) {
            return;
          }
          run(
            unwrap(
              api.DELETE('/admin/apartments/{id}', {
                params: {path: {id: apartment.id}},
              }),
            ).then(onRemoved),
            t.admin.apartment.removeFailed,
          );
        },
      },
    );

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
          await unwrap(
            api.PATCH('/admin/apartments/{id}', {
              params: {path: {id: apartment.id}},
              body: fields,
            }),
          );
          setMode('view');
          onChanged();
        }}
      />
    );
  }

  if (mode === 'new-resident') {
    return (
      <ApartmentForm
        initial={{label: apartment.label, residentName: '', email: ''}}
        withLabel={false}
        note={t.admin.apartment.newResidentNote(cancelNote(apartment, t))}
        submitLabel={t.admin.apartment.replaceResident}
        onCancel={() => setMode('view')}
        onSubmit={async ({residentName, email}) => {
          const result = await unwrap(
            api.POST('/admin/apartments/{id}/new-resident', {
              params: {path: {id: apartment.id}},
              body: {residentName, email},
            }),
          );
          onPassword(result.apartment, result.password);
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
        <h2 className={SECTION_LABEL}>{t.admin.apartment.details}</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <Row
            label={t.admin.apartment.resident}
            value={apartment.residentName}
          />
          <Row label={t.login.email} value={apartment.email} />
          <Row label={t.admin.apartment.lastSignIn} value={signedIn} />
          <Row
            label={t.admin.apartment.upcomingBookings}
            value={String(apartment.upcomingBookings)}
          />
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>{t.admin.apartment.actions}</h2>
        <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label={t.admin.apartment.editDetails}
            description={t.admin.apartment.editDetailsHint}
            onPress={() => setMode('edit')}
          />
          <Action
            label={t.admin.apartment.resetPassword}
            description={t.admin.apartment.resetPasswordHint}
            onPress={resetPassword}
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
        onClick={remove}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        {t.admin.apartment.remove}
      </button>
    </div>
  );
}
