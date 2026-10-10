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
import {useMessages} from '@/i18n/LocaleProvider';
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
  const t = useMessages();
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
    Alert.alert(title, errorMessage(codeOf(caught), t));

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
      t.admin.resource.moveFailed,
    );
  };

  const removeChange = (validFrom: string) =>
    Alert.alert(
      t.admin.resource.removeChange,
      t.admin.resource.removeChangeQuestion(formatLongDate(validFrom, t)),
      [
        {text: t.common.cancel, style: 'cancel'},
        {
          text: t.admin.remove,
          style: 'destructive',
          onPress: () => {
            run(
              () =>
                unwrap(
                  api.DELETE('/admin/resources/{id}/schedule/{validFrom}', {
                    params: {path: {id: resource.id, validFrom}},
                  }),
                ),
              t.admin.resource.removeChangeFailed,
            );
          },
        },
      ],
    );

  const close = () =>
    Alert.alert(
      t.admin.resource.close,
      t.admin.resource.closeQuestion(
        resource.name,
        formatLongDate(earliestChange, t),
      ),
      [
        {text: t.common.cancel, style: 'cancel'},
        {
          text: t.admin.resource.closeAction,
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
              t.admin.resource.closeFailed,
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
      closed ? t.admin.resource.reopenFailed : t.admin.resource.undoCloseFailed,
    );

  if (mode === 'edit') {
    return (
      <ResourceForm
        kinds={kinds}
        initial={{...resource, slots: []}}
        withSlots={false}
        submitLabel={t.admin.save}
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
        <Text className={SECTION_LABEL}>{t.admin.resource.times}</Text>
        <View className={`${CARD} py-1.5`}>
          <View className='gap-0.5 py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>
              {t.admin.resource.now}
            </Text>
            <Text className='font-sans text-sm text-theme-ink'>
              {current ? slotsText(current.slots) : t.admin.resources.noSlots}
            </Text>
          </View>
          {later.map((schedule) => (
            <View
              key={schedule.validFrom}
              className='flex-row items-center justify-between gap-4 border-t border-theme-line py-2.5'
            >
              <View className='min-w-0 flex-1 gap-0.5'>
                <Text className='font-sans text-[13px] text-theme-accent'>
                  {t.admin.resource.from(formatDayMonth(schedule.validFrom, t))}
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
                    {t.admin.remove}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {resource.closesFrom ? (
            <View className='border-t border-theme-line py-2.5'>
              <Text className='font-sans text-[13px] text-theme-accent'>
                {closed
                  ? t.admin.resource.closedSince(
                      formatDayMonth(resource.closesFrom, t),
                    )
                  : t.rules.closes(formatDayMonth(resource.closesFrom, t))}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>{t.admin.apartment.details}</Text>
        <View className={`${CARD} py-1.5`}>
          <View className='flex-row items-baseline justify-between gap-4 border-b border-theme-line py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>
              {t.admin.resource.kind}
            </Text>
            <Text className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'>
              {kind ? `${kind.name} · ${limitText(kind, t)}` : '–'}
            </Text>
          </View>
          <View className='flex-row items-baseline justify-between gap-4 py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>
              {t.admin.resource.tags}
            </Text>
            <Text className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'>
              {resource.tags.length > 0 ? resource.tags.join(', ') : '–'}
            </Text>
          </View>
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>{t.admin.apartment.actions}</Text>
        <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label={t.admin.resource.editTimes}
            description={t.admin.resource.editTimesHint(
              formatDayMonth(earliestChange, t),
            )}
            onPress={() => setMode('schedule')}
          />
          <Action
            label={t.admin.apartment.editDetails}
            description={t.admin.resource.editDetailsHint}
            onPress={() => setMode('edit')}
            last
          />
        </View>
      </View>
      <View className='flex-row flex-wrap gap-2.5'>
        {siblings.length > 1 ? (
          <>
            <Button
              label={t.admin.resource.moveUp}
              disabled={busy || position === 0}
              onPress={() => move(-1)}
            />
            <Button
              label={t.admin.resource.moveDown}
              disabled={busy || position === siblings.length - 1}
              onPress={() => move(1)}
            />
          </>
        ) : null}
        {resource.closesFrom ? (
          <Button
            label={
              closed ? t.admin.resource.reopen : t.admin.resource.undoClose
            }
            disabled={busy}
            onPress={reopen}
          />
        ) : (
          <Button
            label={t.admin.resource.close}
            disabled={busy}
            onPress={close}
          />
        )}
      </View>
    </View>
  );
}
