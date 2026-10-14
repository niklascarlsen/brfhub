import {useAdminAccount} from '@booking/core/admin/account';
import type {Apartment} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {Icon} from '@/components/Icon';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {AdminPage} from '@/admin/AdminPage';
import {ApartmentDetail} from '@/admin/ApartmentDetail';
import {ApartmentForm} from '@/admin/ApartmentForm';
import {Gone} from '@/admin/Gone';
import {useAdminLocation} from '@/admin/location';
import {PRIMARY_BUTTON, PRIMARY_LABEL} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

function matches(apartment: Apartment, query: string): boolean {
  const needle = query.trim().toLowerCase();

  return [apartment.label, apartment.residentName, apartment.email].some(
    (value) => value?.toLowerCase().includes(needle),
  );
}

function ApartmentRow({
  apartment,
  onPress,
  last,
}: {
  apartment: Apartment;
  onPress: () => void;
  last: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3.5 px-[18px] py-3.5 active:bg-theme-sunk ${
        last ? '' : 'border-b border-theme-line'
      }`}
    >
      <View className='h-10 min-w-10 items-center justify-center rounded-full bg-theme-sunk px-2'>
        <Text className='text-sm font-bold text-theme-ink'>
          {apartment.label}
        </Text>
      </View>
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          numberOfLines={1}
          className='text-[15px] font-semibold tracking-tight text-theme-ink'
        >
          {apartment.residentName}
        </Text>
        <Text
          numberOfLines={1}
          className='font-sans text-[13px] text-theme-muted'
        >
          {apartment.email}
        </Text>
      </View>
      <Icon name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
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
        <Text className='font-sans text-sm text-theme-muted'>
          {t.admin.apartments.none}
        </Text>
      ) : (
        <View className='gap-4'>
          <FloatingLabelInput
            label={t.admin.apartments.search}
            value={query}
            onChangeText={setQuery}
            autoCapitalize='none'
            autoCorrect={false}
            returnKeyType='search'
          />
          {shown.length === 0 ? (
            <Text className='font-sans text-sm text-theme-muted'>
              {t.admin.apartments.noMatch}
            </Text>
          ) : (
            <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
              {shown.map((apartment, index) => (
                <ApartmentRow
                  key={apartment.id}
                  apartment={apartment}
                  last={index === shown.length - 1}
                  onPress={() =>
                    open({
                      tab: 'apartments',
                      step: 'apartment',
                      id: apartment.id,
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <View className='gap-3'>
          {Array.from({length: 4}, (_, index) => (
            <SkeletonBar key={index} className='h-16 w-full rounded-2xl' />
          ))}
        </View>
      </Skeleton>
    );
  }

  const subtitle = apartments
    ? `${organizationName} · ${t.admin.apartments.count(apartments.length)}`
    : organizationName;

  return (
    <AdminPage
      title={t.tabs.apartments}
      subtitle={subtitle}
      action={
        <Pressable
          onPress={() => open({tab: 'apartments', step: 'new'})}
          className={PRIMARY_BUTTON}
        >
          <Icon name='add' size={18} color={theme.surface} />
          <Text className={PRIMARY_LABEL}>
            {t.admin.apartments.addApartment}
          </Text>
        </Pressable>
      }
    >
      {body}
    </AdminPage>
  );
}
