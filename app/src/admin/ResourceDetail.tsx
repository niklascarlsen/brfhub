import {limitText, slotsText} from '@booking/core/admin/schedule';
import type {AdminResource, AdminResources} from '@booking/core/api/types';
import {localize} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useIsFocused} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import {BackHandler, Pressable, Text, View} from 'react-native';

import {ResourceForm} from '@/admin/ResourceForm';
import {ScheduleForm} from '@/admin/ScheduleForm';
import {useConfirmLeave} from '@/admin/unsaved';
import {
  CARD,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

type ResourceDetailProps = {
  resource: AdminResource;
  data: AdminResources;
  // After every change, and after a failure that means the resource shown
  // is out of date.
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
  const {locale} = useLocale();
  const [mode, setMode] = useState<Mode>('view');
  const confirmLeave = useConfirmLeave();
  // Every tab keeps its screen, so only the one shown answers the back
  // button.
  const focused = useIsFocused();
  const tags = localize(resource.tags, locale) ?? [];

  // Back from a form returns to the resource, not to the list. Registered
  // after the list's handler, so it is asked first.
  useEffect(() => {
    if (mode === 'view' || !focused) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmLeave(() => setMode('view'));
        return true;
      },
    );

    return () => subscription.remove();
  }, [mode, focused, confirmLeave]);
  const {kinds, earliestChange, today} = data;
  const kind = kinds.find((item) => item.id === resource.kindId);
  const [current, ...later] = resource.schedules;
  const latest = resource.schedules.at(-1);
  const closed = resource.closesFrom !== null && resource.closesFrom <= today;

  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(onChanged, setBusy);

  // Members see the resources grouped by kind, so a move swaps places with
  // the neighbour of the same kind.
  const siblings = data.resources.filter(
    (item) => item.kindId === resource.kindId,
  );
  const position = siblings.findIndex((item) => item.id === resource.id);

  if (mode === 'edit') {
    return (
      <ResourceForm
        kinds={kinds}
        initial={{...resource, slots: []}}
        withSlots={false}
        submitLabel={t.admin.save}
        onCancel={() => setMode('view')}
        onSubmit={async (fields) => {
          await actions.resources.update(resource.id, fields);
          setMode('view');
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
          await actions.resources.saveSchedule(
            resource.id,
            earliestChange,
            slots,
          );
          setMode('view');
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
                  onPress={() =>
                    actions.resources.confirmRemoveChange(
                      resource.id,
                      schedule.validFrom,
                    )
                  }
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
        <Text className={SECTION_LABEL}>{t.admin.details}</Text>
        <View className={`${CARD} py-1.5`}>
          <View className='flex-row items-baseline justify-between gap-4 border-b border-theme-line py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>
              {t.admin.resource.kind}
            </Text>
            <Text className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'>
              {kind
                ? `${localize(kind.name, locale)} · ${limitText(kind, t)}`
                : '–'}
            </Text>
          </View>
          <View className='flex-row items-baseline justify-between gap-4 py-2.5'>
            <Text className='font-sans text-[13px] text-theme-muted'>
              {t.admin.resource.tags}
            </Text>
            <Text className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'>
              {tags.length > 0 ? tags.join(', ') : '–'}
            </Text>
          </View>
        </View>
      </View>
      <View>
        <Text className={SECTION_LABEL}>{t.admin.actions}</Text>
        <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
          <Action
            label={t.admin.resource.editTimes}
            description={t.admin.resource.editTimesHint(
              formatDayMonth(earliestChange, t),
            )}
            onPress={() => setMode('schedule')}
          />
          <Action
            label={t.admin.editDetails}
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
              onPress={() =>
                actions.resources.move(data.resources, resource, -1)
              }
            />
            <Button
              label={t.admin.resource.moveDown}
              disabled={busy || position === siblings.length - 1}
              onPress={() =>
                actions.resources.move(data.resources, resource, 1)
              }
            />
          </>
        ) : null}
        {resource.closesFrom ? (
          <Button
            label={
              closed ? t.admin.resource.reopen : t.admin.resource.undoClose
            }
            disabled={busy}
            onPress={() => void actions.resources.reopen(resource.id, closed)}
          />
        ) : (
          <Button
            label={t.admin.resource.close}
            disabled={busy}
            onPress={() =>
              actions.resources.confirmClose(
                resource.id,
                localize(resource.name, locale) ?? '',
                earliestChange,
              )
            }
          />
        )}
      </View>
    </View>
  );
}
