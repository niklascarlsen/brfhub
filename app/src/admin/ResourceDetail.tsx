import {changeDays} from '@booking/core/admin/change';
import {limitText, slotsText} from '@booking/core/admin/schedule';
import type {AdminResource, AdminResources} from '@booking/core/api/types';
import {localize} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {ActionRow} from '@/admin/Rows';
import {
  CARD,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import {useAdminActions} from '@/hooks/useAdminActions';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

type ResourceDetailProps = {
  resource: AdminResource;
  data: AdminResources;
  // After every change, and after a failure that means the resource shown
  // is out of date.
  onChanged: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onClose: () => void;
  // After the resource is removed, which leaves nothing to show.
  onRemoved: () => void;
};

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
  onEdit,
  onSchedule,
  onClose,
  onRemoved,
}: ResourceDetailProps) {
  const t = useMessages();
  const {locale} = useLocale();
  const tags = localize(resource.tags, locale) ?? [];
  const note = localize(resource.closingNote, locale);
  const {kinds, today} = data;
  const kind = kinds.find((item) => item.id === resource.kindId);
  const [current, ...later] = resource.schedules;
  const closed = resource.closesFrom !== null && resource.closesFrom <= today;

  const [busy, setBusy] = useState(false);
  const actions = useAdminActions(onChanged, setBusy);

  // Members see the resources grouped by kind, so a move swaps places with
  // the neighbour of the same kind.
  const siblings = data.resources.filter(
    (item) => item.kindId === resource.kindId,
  );
  const position = siblings.findIndex((item) => item.id === resource.id);

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
              {schedule.validFrom > today ? (
                <Pressable
                  onPress={() =>
                    void actions.resources.confirmRemoveChange(
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
            <View className='gap-0.5 border-t border-theme-line py-2.5'>
              <Text className='font-sans text-[13px] text-theme-accent'>
                {closed
                  ? t.admin.resource.closedSince(
                      formatDayMonth(resource.closesFrom, t),
                    )
                  : t.rules.closes(formatDayMonth(resource.closesFrom, t))}
              </Text>
              {note ? (
                <Text className='font-sans text-sm text-theme-ink'>{note}</Text>
              ) : null}
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
          <ActionRow
            label={t.admin.resource.editTimes}
            description={t.admin.resource.editTimesHint(
              formatDayMonth(
                changeDays('schedule', today, resource.freeFrom).free,
                t,
              ),
            )}
            onPress={onSchedule}
          />
          <ActionRow
            label={t.admin.editDetails}
            description={t.admin.resource.editDetailsHint}
            onPress={onEdit}
            last={resource.closesFrom !== null}
          />
          {resource.closesFrom ? null : (
            <ActionRow
              label={t.admin.resource.close}
              description={t.admin.resource.closeHint}
              onPress={onClose}
              last
            />
          )}
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
        ) : null}
        {closed ? (
          <Button
            label={t.admin.resource.remove}
            disabled={busy}
            onPress={() =>
              actions.resources.confirmRemove(
                resource.id,
                localize(resource.name, locale) ?? '',
                onRemoved,
              )
            }
          />
        ) : null}
      </View>
      {resource.closesFrom && !closed ? (
        <Text className='-mt-4 font-sans text-[13px] leading-5 text-theme-muted'>
          {t.admin.resource.removableFrom(
            formatDayMonth(resource.closesFrom, t),
          )}
        </Text>
      ) : null}
    </View>
  );
}
