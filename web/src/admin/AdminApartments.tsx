import {useAdminAccount} from '@brfhub/core/admin/account';
import type {Apartment} from '@brfhub/core/api/types';
import {useSlowLoad} from '@brfhub/core/hooks/useSlowLoad';
import {useState} from 'react';

import {AdminPage} from '@/admin/AdminPage';
import {ApartmentDetail} from '@/admin/ApartmentDetail';
import {ApartmentForm} from '@/admin/ApartmentForm';
import {Gone} from '@/admin/Gone';
import {useAdminLocation} from '@/admin/location';
import {LIST, PRIMARY_BUTTON} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

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
  const t = useMessages();
  const {
    data: apartments,
    error,
    loading,
    reload,
  } = useFocusLoad(adminLoad.apartments);
  const showSkeleton = useSlowLoad(apartments === null && error === null);
  const {location, open, up} = useAdminLocation('apartments');
  const [query, setQuery] = useState('');
  const actions = useAdminActions(reload);
  const toList = {label: t.tabs.apartments, onPress: up};
  // A step opened by its address has no list to fall back on.
  const failed =
    error && !apartments ? (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    ) : null;

  if (location.step === 'new') {
    return (
      <AdminPage
        title={t.admin.apartments.newTitle}
        subtitle={organizationName}
        back={toList}
      >
        <ApartmentForm
          initial={{label: '', residentName: '', email: ''}}
          withLabel
          note={t.admin.apartments.newNote}
          submitLabel={t.admin.add}
          onCancel={up}
          onSubmit={async (fields) => {
            const created = await actions.apartments.create(fields);
            open(
              {tab: 'apartments', step: 'apartment', id: created.id},
              {replace: true},
            );
          }}
        />
      </AdminPage>
    );
  }

  if ('id' in location) {
    const {id} = location;
    const apartment = apartments?.find((item) => item.id === id);
    const title = apartment ? t.apartment.title(apartment.label) : '';
    // Named after the apartment once it is loaded.
    const toApartment = {label: title || t.tabs.apartments, onPress: up};
    let content = null;

    if (apartment && location.step === 'edit') {
      content = (
        <ApartmentForm
          initial={{
            label: apartment.label,
            residentName: apartment.residentName,
            email: apartment.email,
          }}
          withLabel
          note={t.admin.apartment.editNote}
          submitLabel={t.admin.save}
          onCancel={up}
          onSubmit={async (fields) => {
            await actions.apartments.update(apartment.id, fields);
            up();
          }}
        />
      );
    } else if (apartment && location.step === 'new-resident') {
      content = (
        <ApartmentForm
          initial={{label: apartment.label, residentName: '', email: ''}}
          withLabel={false}
          note={t.admin.apartment.newResidentNote(
            t.admin.apartment.cancelNote(apartment.upcomingBookings),
          )}
          submitLabel={t.admin.apartment.replaceResident}
          onCancel={up}
          onSubmit={async (fields) => {
            await actions.apartments.newResident(apartment.id, fields);
            up();
          }}
        />
      );
    } else if (apartment) {
      content = (
        <ApartmentDetail
          key={apartment.id}
          apartment={apartment}
          onChanged={reload}
          onRemoved={up}
          onEdit={() => open({tab: 'apartments', step: 'edit', id})}
          onNewResident={() =>
            open({tab: 'apartments', step: 'new-resident', id})
          }
        />
      );
    }
    const gone = !apartment && apartments !== null && !loading;

    return (
      <AdminPage
        title={
          gone
            ? t.admin.goneTitle
            : location.step === 'edit'
              ? t.admin.editDetails
              : location.step === 'new-resident'
                ? t.admin.apartment.newResident
                : title
        }
        subtitle={organizationName}
        back={location.step === 'apartment' ? toList : toApartment}
      >
        {gone ? <Gone /> : (content ?? failed)}
      </AdminPage>
    );
  }

  const shown = apartments?.filter((apartment) => matches(apartment, query));

  let body = null;
  if (apartments && shown) {
    body =
      apartments.length === 0 ? (
        <p className='text-sm text-theme-muted'>{t.admin.apartments.none}</p>
      ) : (
        <div className='flex flex-col gap-4'>
          <FloatingLabelInput
            label={t.admin.apartments.search}
            type='search'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {shown.length === 0 ? (
            <p className='text-sm text-theme-muted'>
              {t.admin.apartments.noMatch}
            </p>
          ) : (
            <div className={LIST}>
              {shown.map((apartment) => (
                <ApartmentRow
                  key={apartment.id}
                  apartment={apartment}
                  onPress={() =>
                    open({
                      tab: 'apartments',
                      step: 'apartment',
                      id: apartment.id,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <div className='flex flex-col gap-3'>
          {Array.from({length: 4}, (_, index) => (
            <SkeletonBar key={index} className='h-16 w-full rounded-card' />
          ))}
        </div>
      </Skeleton>
    );
  }

  const count = apartments
    ? t.admin.apartments.count(apartments.length)
    : organizationName;

  return (
    <AdminPage
      title={t.tabs.apartments}
      subtitle={apartments ? `${organizationName} · ${count}` : count}
      action={
        <button
          type='button'
          onClick={() => open({tab: 'apartments', step: 'new'})}
          className={PRIMARY_BUTTON}
        >
          <AddIcon size={18} />
          {t.admin.apartments.addApartment}
        </button>
      }
    >
      {body}
    </AdminPage>
  );
}
