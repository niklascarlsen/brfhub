import {useState} from 'react';

import {ApartmentForm} from '@/admin/ApartmentForm';
import {CARD, SECONDARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap, type Apartment} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {useDialog} from '@/components/Dialog';
import {ChevronForwardIcon} from '@/components/icons';
import {formatLongDate, toIsoDate} from '@/lib/dates';

type ApartmentDetailProps = {
  apartment: Apartment;
  onChanged: () => void;
  onPassword: (apartment: Apartment, password: string) => void;
  onRemoved: () => void;
};

function bookingsWord(count: number): string {
  return count === 1 ? '1 kommande bokning' : `${count} kommande bokningar`;
}

// What the admin is told before anything that cancels the apartment's
// bookings, since those are times someone else is counting on.
function cancelNote(apartment: Apartment): string {
  return apartment.upcomingBookings === 0
    ? 'Lägenheten har inga kommande bokningar.'
    : `Lägenhetens ${bookingsWord(apartment.upcomingBookings)} avbokas, och den som köar får en notis.`;
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
  const [mode, setMode] = useState<Mode>('view');
  // A second tap while a request runs would reset twice or remove twice.
  const [busy, setBusy] = useState(false);

  const run = (request: Promise<void>, failTitle: string) => {
    setBusy(true);
    request.catch(fail(failTitle)).finally(() => setBusy(false));
  };

  const fail = (title: string) => (caught: unknown) =>
    dialog.alert(title, errorMessage(codeOf(caught)));

  const resetPassword = () =>
    dialog.confirm(
      'Återställ lösenord',
      `Lägenhet ${apartment.label} får ett nytt lösenord och loggas ut på alla enheter.`,
      {
        label: 'Återställ',
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
            'Kunde inte återställa lösenordet',
          );
        },
      },
    );

  const remove = () =>
    dialog.confirm(
      'Ta bort lägenheten',
      `${cancelNote(apartment)} Kontot tas bort och numret kan användas igen.`,
      {
        label: 'Ta bort',
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
            'Kunde inte ta bort lägenheten',
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
        note='Ändras e-posten loggas lägenheten ut och loggar in med den nya adressen.'
        submitLabel='Spara'
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
        note={`${cancelNote(apartment)} Det gamla kontot tas bort och de nya boende får ett eget lösenord.`}
        submitLabel='Byt boende'
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

  const signedIn = apartment.lastSignInAt
    ? formatLongDate(toIsoDate(new Date(apartment.lastSignInAt)))
    : 'Aldrig';

  return (
    <div className='flex flex-col gap-6.5'>
      <section>
        <h2 className={SECTION_LABEL}>Uppgifter</h2>
        <div
          className={`${CARD} flex flex-col divide-y divide-theme-line py-1.5`}
        >
          <Row label='Boende' value={apartment.residentName} />
          <Row label='E-post' value={apartment.email} />
          <Row label='Senast inloggad' value={signedIn} />
          <Row
            label='Kommande bokningar'
            value={String(apartment.upcomingBookings)}
          />
        </div>
      </section>
      <section>
        <h2 className={SECTION_LABEL}>Åtgärder</h2>
        <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label='Ändra uppgifter'
            description='Nummer, namn och e-post'
            onPress={() => setMode('edit')}
          />
          <Action
            label='Återställ lösenord'
            description='När de boende har glömt det'
            onPress={resetPassword}
          />
          <Action
            label='Ny boende'
            description='När lägenheten byter ägare'
            onPress={() => setMode('new-resident')}
          />
        </div>
      </section>
      <button
        type='button'
        onClick={remove}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        Ta bort lägenheten
      </button>
    </div>
  );
}
