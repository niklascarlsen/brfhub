import Ionicons from '@expo/vector-icons/Ionicons';
import {useEffect, useState} from 'react';
import {BackHandler, Pressable, Text, View} from 'react-native';

import {useAdminAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {ApartmentDetail} from '@/admin/ApartmentDetail';
import {ApartmentForm} from '@/admin/ApartmentForm';
import {PasswordCard} from '@/admin/PasswordCard';
import {PRIMARY_BUTTON, PRIMARY_LABEL} from '@/admin/styles';
import {api, unwrap, type Apartment} from '@/api/client';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
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
  const {data: apartments, error, reload} = useFocusLoad(fetchApartments);
  const showSkeleton = useSlowLoad(apartments === null && error === null);
  const [view, setView] = useState<Screen>({kind: 'list'});
  const [query, setQuery] = useState('');

  const toList = () => setView({kind: 'list'});

  // The steps below the list are not screens of their own, so Android's
  // back button would otherwise leave the app instead of going back.
  useEffect(() => {
    if (view.kind === 'list') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setView({kind: 'list'});
        return true;
      },
    );

    return () => subscription.remove();
  }, [view.kind]);
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
        <Text className='font-sans text-sm text-theme-muted'>
          Inga lägenheter än. Lägg till den första.
        </Text>
      ) : (
        <View className='gap-4'>
          <FloatingLabelInput
            label='Sök nummer, namn eller e-post'
            value={query}
            onChangeText={setQuery}
            autoCapitalize='none'
            autoCorrect={false}
            returnKeyType='search'
          />
          {shown.length === 0 ? (
            <Text className='font-sans text-sm text-theme-muted'>
              Ingen lägenhet matchar.
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
      <Notice message={error} actionLabel='Försök igen' onAction={reload} />
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
    ? `${organizationName} · ${apartments.length} ${
        apartments.length === 1 ? 'lägenhet' : 'lägenheter'
      }`
    : organizationName;

  return (
    <AdminPage
      title='Lägenheter'
      subtitle={subtitle}
      action={
        <Pressable
          onPress={() => setView({kind: 'add'})}
          className={PRIMARY_BUTTON}
        >
          <Ionicons name='add' size={18} color={theme.surface} />
          <Text className={PRIMARY_LABEL}>Lägg till lägenhet</Text>
        </Pressable>
      }
    >
      {body}
    </AdminPage>
  );
}
