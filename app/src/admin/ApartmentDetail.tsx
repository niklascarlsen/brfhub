import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Alert, Pressable, Text, View} from 'react-native';

import {ApartmentForm} from '@/admin/ApartmentForm';
import {
  CARD,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import {api, unwrap, type Apartment} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {formatLongDate} from '@/lib/dates';
import theme from '@/theme.json';

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
  onPress,
  last,
}: {
  label: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
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
  onPassword,
  onRemoved,
}: ApartmentDetailProps) {
  const [mode, setMode] = useState<Mode>('view');
  // A second tap while a request runs would reset twice or remove twice.
  const [busy, setBusy] = useState(false);

  const run = (request: Promise<void>, failTitle: string) => {
    setBusy(true);
    request.catch(fail(failTitle)).finally(() => setBusy(false));
  };

  const fail = (title: string) => (caught: unknown) =>
    Alert.alert(title, errorMessage(codeOf(caught)));

  const resetPassword = () =>
    Alert.alert(
      'Återställ lösenord',
      `Lägenhet ${apartment.label} får ett nytt lösenord och loggas ut på alla enheter.`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Återställ',
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
      ],
    );

  const remove = () =>
    Alert.alert(
      'Ta bort lägenheten',
      `${cancelNote(apartment)} Kontot tas bort och numret kan användas igen.`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Ta bort',
          style: 'destructive',
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
      ],
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

  const signedIn = apartment.lastSignInOn
    ? formatLongDate(apartment.lastSignInOn)
    : 'Aldrig';

  return (
    <View className='gap-[26px]'>
      <View>
        <Text className={SECTION_LABEL}>Uppgifter</Text>
        <View className={`${CARD} py-1.5`}>
          <Row label='Boende' value={apartment.residentName} />
          <Row label='E-post' value={apartment.email} />
          <Row label='Senast inloggad' value={signedIn} />
          <Row
            label='Kommande bokningar'
            value={String(apartment.upcomingBookings)}
            last
          />
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>Åtgärder</Text>
        <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
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
            last
          />
        </View>
      </View>
      <Pressable onPress={remove} className={`${SECONDARY_BUTTON} self-start`}>
        <Text className={SECONDARY_LABEL}>Ta bort lägenheten</Text>
      </Pressable>
    </View>
  );
}
