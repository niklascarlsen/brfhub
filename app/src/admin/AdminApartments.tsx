import {useAdminAccount} from '@booking/core/admin/account';
import type {Apartment} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useIsFocused} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import {BackHandler, Pressable, Text, View} from 'react-native';

import {AdminPage} from '@/admin/AdminPage';
import {ApartmentDetail} from '@/admin/ApartmentDetail';
import {ApartmentForm} from '@/admin/ApartmentForm';
import {PasswordCard} from '@/admin/PasswordCard';
import {useConfirmLeave} from '@/admin/unsaved';
import {PRIMARY_BUTTON, PRIMARY_LABEL} from '@/admin/styles';
import {api, unwrap} from '@/api/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

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
      <Ionicons name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
  );
}

export function AdminApartments() {
  const {organizationName} = useAdminAccount();
  const t = useMessages();
  const {data: apartments, error, reload} = useFocusLoad(fetchApartments);
  const showSkeleton = useSlowLoad(apartments === null && error === null);
  const [view, setView] = useState<Screen>({kind: 'list'});
  const [query, setQuery] = useState('');

  const confirmLeave = useConfirmLeave();
  // Every tab keeps its screen, so only the one shown answers the back
  // button.
  const focused = useIsFocused();

  const toList = () => setView({kind: 'list'});

  // The steps below the list are not screens of their own, so Android's
  // back button would otherwise leave the app instead of going back.
  useEffect(() => {
    if (view.kind === 'list' || !focused) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmLeave(() => setView({kind: 'list'}));
        return true;
      },
    );

    return () => subscription.remove();
  }, [view.kind, focused, confirmLeave]);
  const showPassword = (apartment: Apartment, password: string) => {
    reload();
    setView({kind: 'password', apartment, password});
  };

  if (view.kind === 'add') {
    return (
      <AdminPage
        title={t.admin.apartments.newTitle}
        subtitle={organizationName}
        back={{label: t.tabs.apartments, onPress: toList}}
      >
        <ApartmentForm
          initial={{label: '', residentName: '', email: ''}}
          withLabel
          note={t.admin.apartments.newNote}
          submitLabel={t.admin.add}
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
        title={t.apartment.title(view.apartment.label)}
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
          title={t.apartment.title(apartment.label)}
          subtitle={organizationName}
          back={{label: t.tabs.apartments, onPress: toList}}
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
                  onPress={() => setView({kind: 'apartment', id: apartment.id})}
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
          onPress={() => setView({kind: 'add'})}
          className={PRIMARY_BUTTON}
        >
          <Ionicons name='add' size={18} color={theme.surface} />
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
