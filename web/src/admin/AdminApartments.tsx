import {useState} from 'react';

import {useAdminAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {ApartmentDetail} from '@/admin/ApartmentDetail';
import {ApartmentForm} from '@/admin/ApartmentForm';
import {PasswordCard} from '@/admin/PasswordCard';
import {PRIMARY_BUTTON} from '@/admin/styles';
import {api, unwrap, type Apartment} from '@/api/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';

function fetchApartments() {
  return unwrap(api.GET('/admin/apartments'));
}

type Screen =
  | {kind: 'list'}
  | {kind: 'add'}
  | {kind: 'apartment'; id: string}
  | {kind: 'password'; apartment: Apartment; password: string};

function matches(apartment: Apartment, query: string): boolean {
  const needle = query.trim().toLowerCase();

  return [apartment.label, apartment.residentName, apartment.email].some(
    (value) => value?.toLowerCase().includes(needle),
  );
}

function ApartmentRow({
  apartment,
  onPress,
}: {
  apartment: Apartment;
  onPress: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onPress}
      className='flex w-full items-center gap-3.5 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
    >
      <span className='flex h-10 min-w-10 items-center justify-center rounded-full bg-theme-sunk px-2 text-sm font-bold text-theme-ink tabular-nums'>
        {apartment.label}
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='truncate text-[15px] font-semibold tracking-tight text-theme-ink'>
          {apartment.residentName}
        </span>
        <span className='truncate text-[13px] text-theme-muted'>
          {apartment.email}
        </span>
      </span>
      <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
    </button>
  );
}

export function AdminApartments() {
  const {organizationName} = useAdminAccount();
  const {data: apartments, error, reload} = useFocusLoad(fetchApartments);
  const showSkeleton = useSlowLoad(apartments === null && error === null);
  const [view, setView] = useState<Screen>({kind: 'list'});
  const [query, setQuery] = useState('');

  const toList = () => setView({kind: 'list'});
  const showPassword = (apartment: Apartment, password: string) => {
    reload();
    setView({kind: 'password', apartment, password});
  };

  if (view.kind === 'add') {
    return (
      <AdminPage
        title='Ny lägenhet'
        subtitle={organizationName}
        back={{label: 'Lägenheter', onPress: toList}}
      >
        <ApartmentForm
          initial={{label: '', residentName: '', email: ''}}
          withLabel
          note='Lägenheten får ett lösenord som visas en gång, efter att du har sparat.'
          submitLabel='Lägg till'
          onCancel={toList}
          onSubmit={async (fields) => {
            const result = await unwrap(
              api.POST('/admin/apartments', {body: fields}),
            );
            showPassword(result.apartment, result.password);
          }}
        />
      </AdminPage>
    );
  }

  if (view.kind === 'password') {
    return (
      <AdminPage
        title={`Lägenhet ${view.apartment.label}`}
        subtitle={organizationName}
      >
        <PasswordCard
          apartment={view.apartment}
          password={view.password}
          onDone={() => setView({kind: 'apartment', id: view.apartment.id})}
        />
      </AdminPage>
    );
  }

  if (view.kind === 'apartment') {
    const apartment = apartments?.find((item) => item.id === view.id);

    if (apartment) {
      return (
        <AdminPage
          title={`Lägenhet ${apartment.label}`}
          subtitle={organizationName}
          back={{label: 'Lägenheter', onPress: toList}}
        >
          <ApartmentDetail
            key={apartment.id}
            apartment={apartment}
            onChanged={reload}
            onPassword={showPassword}
            onRemoved={() => {
              reload();
              toList();
            }}
          />
        </AdminPage>
      );
    }
  }

  const shown = apartments?.filter((apartment) => matches(apartment, query));

  let body = null;
  if (apartments && shown) {
    body =
      apartments.length === 0 ? (
        <p className='text-sm text-theme-muted'>
          Inga lägenheter än. Lägg till den första.
        </p>
      ) : (
        <div className='flex flex-col gap-4'>
          <FloatingLabelInput
            label='Sök nummer, namn eller e-post'
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {shown.length === 0 ? (
            <p className='text-sm text-theme-muted'>Ingen lägenhet matchar.</p>
          ) : (
            <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
              {shown.map((apartment) => (
                <ApartmentRow
                  key={apartment.id}
                  apartment={apartment}
                  onPress={() => setView({kind: 'apartment', id: apartment.id})}
                />
              ))}
            </div>
          )}
        </div>
      );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel='Försök igen' onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <div className='flex flex-col gap-3'>
          {Array.from({length: 4}, (_, index) => (
            <SkeletonBar key={index} className='h-16 w-full rounded-2xl' />
          ))}
        </div>
      </Skeleton>
    );
  }

  const count = apartments
    ? `${apartments.length} ${apartments.length === 1 ? 'lägenhet' : 'lägenheter'}`
    : organizationName;

  return (
    <AdminPage
      title='Lägenheter'
      subtitle={apartments ? `${organizationName} · ${count}` : count}
      action={
        <button
          type='button'
          onClick={() => setView({kind: 'add'})}
          className={PRIMARY_BUTTON}
        >
          <AddIcon size={18} />
          Lägg till lägenhet
        </button>
      }
    >
      {body}
    </AdminPage>
  );
}
