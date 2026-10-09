import Ionicons from '@expo/vector-icons/Ionicons';
import {useEffect, useState} from 'react';
import {Alert, BackHandler, Pressable, Text, View} from 'react-native';

import {ResourceForm} from '@/admin/ResourceForm';
import {ScheduleForm} from '@/admin/ScheduleForm';
import {limitText, slotsText} from '@/admin/schedule';
import {
  CARD,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import {
  api,
  unwrap,
  type AdminResource,
  type AdminResources,
} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {formatDayMonth, formatLongDate} from '@/lib/dates';
import theme from '@/theme.json';

type ResourceDetailProps = {
  resource: AdminResource;
  data: AdminResources;
  onChanged: () => void;
};

type Mode = 'view' | 'edit' | 'schedule';

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

function Button({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={SECONDARY_BUTTON}
    >
      <Text className={SECONDARY_LABEL}>{label}</Text>
    </Pressable>
  );
}

export function ResourceDetail({
  resource,
  data,
  onChanged,
}: ResourceDetailProps) {
  const [mode, setMode] = useState<Mode>('view');

  // Back from a form returns to the resource, not to the list. Registered
  // after the list's handler, so it is asked first.
  useEffect(() => {
    if (mode === 'view') {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setMode('view');
        return true;
      },
    );

    return () => subscription.remove();
  }, [mode]);
  const {kinds, earliestChange, today} = data;
  const kind = kinds.find((item) => item.id === resource.kindId);
  const [current, ...later] = resource.schedules;
  const latest = resource.schedules.at(-1);
  const closed = resource.closesFrom !== null && resource.closesFrom <= today;

  const fail = (title: string) => (caught: unknown) =>
    Alert.alert(title, errorMessage(codeOf(caught)));

  const [busy, setBusy] = useState(false);

  const run = (request: () => Promise<unknown>, failTitle: string) => {
    if (busy) {
      return;
    }

    setBusy(true);
    request()
      .then(onChanged)
      .catch(fail(failTitle))
      .finally(() => setBusy(false));
  };

  // Members see the resources grouped by kind, so a move swaps places with
  // the neighbour of the same kind.
  const siblings = data.resources.filter(
    (item) => item.kindId === resource.kindId,
  );
  const position = siblings.findIndex((item) => item.id === resource.id);

  const move = (by: number) => {
    const neighbour = siblings[position + by];

    if (!neighbour) {
      return;
    }

    const ids = data.resources.map((item) =>
      item.id === resource.id
        ? neighbour.id
        : item.id === neighbour.id
          ? resource.id
          : item.id,
    );
    run(
      () => unwrap(api.PUT('/admin/resources/order', {body: {ids}})),
      'Kunde inte flytta resursen',
    );
  };

  const removeChange = (validFrom: string) =>
    Alert.alert(
      'Ta bort ändringen',
      `Tiderna från ${formatLongDate(validFrom)} tas bort, och de nuvarande gäller vidare.`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: () => {
            run(
              () =>
                unwrap(
                  api.DELETE('/admin/resources/{id}/schedule/{validFrom}', {
                    params: {path: {id: resource.id, validFrom}},
                  }),
                ),
              'Kunde inte ta bort ändringen',
            );
          },
        },
      ],
    );

  const close = () =>
    Alert.alert(
      'Stäng resursen',
      `${resource.name} går att boka till och med dagen före ${formatLongDate(earliestChange)}. Bokningar fram till dess står kvar.`,
      [
        {text: 'Avbryt', style: 'cancel'},
        {
          text: 'Stäng',
          style: 'destructive',
          onPress: () => {
            run(
              () =>
                unwrap(
                  api.PUT('/admin/resources/{id}/closing', {
                    params: {path: {id: resource.id}},
                    body: {closesFrom: earliestChange},
                  }),
                ),
              'Kunde inte stänga resursen',
            );
          },
        },
      ],
    );

  const reopen = () =>
    run(
      () =>
        unwrap(
          api.DELETE('/admin/resources/{id}/closing', {
            params: {path: {id: resource.id}},
          }),
        ),
      closed ? 'Kunde inte öppna resursen' : 'Kunde inte ångra stängningen',
    );

  if (mode === 'edit') {
    return (
      <ResourceForm
        kinds={kinds}
        initial={{...resource, slots: []}}
        withSlots={false}
        submitLabel='Spara'
        onCancel={() => setMode('view')}
        onSubmit={async ({name, kindId, tags}) => {
          await unwrap(
            api.PATCH('/admin/resources/{id}', {
              params: {path: {id: resource.id}},
              body: {name, kindId, tags},
            }),
          );
          setMode('view');
          onChanged();
        }}
      />
    );
  }

  if (mode === 'schedule') {
    return (
      <ScheduleForm
        initial={latest?.slots ?? []}
        validFrom={earliestChange}
        onCancel={() => setMode('view')}
        onSubmit={async (slots) => {
          await unwrap(
            api.PUT('/admin/resources/{id}/schedule', {
              params: {path: {id: resource.id}},
              body: {validFrom: earliestChange, slots},
            }),
          );
          setMode('view');
          onChanged();
        }}
      />
    );
  }

  return (
    <View className='gap-[26px]'>
      <View>
        <Text className={SECTION_LABEL}>Tider</Text>
        <View className={`${CARD} py-1.5`}>
          <View className='gap-0.5 py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>Nu</Text>
            <Text className='font-sans text-sm text-theme-ink'>
              {current ? slotsText(current.slots) : 'Inga pass'}
            </Text>
          </View>
          {later.map((schedule) => (
            <View
              key={schedule.validFrom}
              className='flex-row items-center justify-between gap-4 border-t border-theme-line py-2.5'
            >
              <View className='min-w-0 flex-1 gap-0.5'>
                <Text className='font-sans text-[13px] text-theme-accent'>
                  Från {formatDayMonth(schedule.validFrom)}
                </Text>
                <Text className='font-sans text-sm text-theme-ink'>
                  {slotsText(schedule.slots)}
                </Text>
              </View>
              {schedule.validFrom >= earliestChange ? (
                <Pressable
                  onPress={() => removeChange(schedule.validFrom)}
                  hitSlop={8}
                  className='active:opacity-60'
                >
                  <Text className='text-[13px] font-semibold text-theme-muted'>
                    Ta bort
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {resource.closesFrom ? (
            <View className='border-t border-theme-line py-2.5'>
              <Text className='font-sans text-[13px] text-theme-accent'>
                {closed ? 'Stängd sedan' : 'Stängs'}{' '}
                {formatDayMonth(resource.closesFrom)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>Uppgifter</Text>
        <View className={`${CARD} py-1.5`}>
          <View className='flex-row items-baseline justify-between gap-4 border-b border-theme-line py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>Typ</Text>
            <Text className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'>
              {kind ? `${kind.name} · ${limitText(kind)}` : '–'}
            </Text>
          </View>
          <View className='flex-row items-baseline justify-between gap-4 py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>
              Taggar
            </Text>
            <Text className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'>
              {resource.tags.length > 0 ? resource.tags.join(', ') : '–'}
            </Text>
          </View>
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>Åtgärder</Text>
        <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label='Ändra tider'
            description={`Gäller från ${formatDayMonth(earliestChange)}, efter bokningsfönstret`}
            onPress={() => setMode('schedule')}
          />
          <Action
            label='Ändra uppgifter'
            description='Namn, typ och taggar'
            onPress={() => setMode('edit')}
            last
          />
        </View>
      </View>
      <View className='flex-row flex-wrap gap-2.5'>
        {siblings.length > 1 ? (
          <>
            <Button
              label='Flytta upp'
              disabled={busy || position === 0}
              onPress={() => move(-1)}
            />
            <Button
              label='Flytta ner'
              disabled={busy || position === siblings.length - 1}
              onPress={() => move(1)}
            />
          </>
        ) : null}
        {resource.closesFrom ? (
          <Button
            label={closed ? 'Öppna igen' : 'Ångra stängningen'}
            disabled={busy}
            onPress={reopen}
          />
        ) : (
          <Button label='Stäng resursen' disabled={busy} onPress={close} />
        )}
      </View>
    </View>
  );
}
