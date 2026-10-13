import type {Apartment} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {ApartmentForm} from '@/admin/ApartmentForm';
import {
  CARD,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

type ApartmentDetailProps = {
  apartment: Apartment;
  // After every change, and after a failure that means the apartment
  // shown is out of date.
  onChanged: () => void;
  onRemoved: () => void;
};

function Row({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-baseline justify-between gap-4 py-2.5 ${
        last ? '' : 'border-b border-theme-line'
      }`}
    >
      <Text className='shrink-0 font-sans text-[13px] text-theme-muted'>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'
      >
        {value}
      </Text>
    </View>
  );
}

function Action({
  label,
  description,
  disabled = false,
  onPress,
  last,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 px-[18px] py-3.5 active:bg-theme-sunk ${
        last ? '' : 'border-b border-theme-line'
      }`}
    >
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {label}
        </Text>
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {description}
        </Text>
      </View>
      <Ionicons name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
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
    <View className='gap-[26px]'>
      <View>
        <Text className={SECTION_LABEL}>{t.admin.details}</Text>
        <View className={`${CARD} py-1.5`}>
          <Row
            label={t.admin.apartment.resident}
            value={apartment.residentName}
          />
          <Row label={t.common.email} value={apartment.email} />
          <Row label={t.admin.apartment.lastSignIn} value={signedIn} />
          <Row
            label={t.admin.apartment.upcomingBookings}
            value={String(apartment.upcomingBookings)}
            last
          />
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>{t.admin.actions}</Text>
        <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
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
            last
          />
        </View>
      </View>
      <Pressable
        onPress={() => actions.apartments.confirmRemove(apartment, onRemoved)}
        disabled={busy}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        <Text className={SECONDARY_LABEL}>{t.admin.apartment.remove}</Text>
      </Pressable>
    </View>
  );
}
