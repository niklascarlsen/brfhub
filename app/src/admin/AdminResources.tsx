import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import {missingLanguages} from '@booking/core/admin/localized';
import {limitText, slotsText} from '@booking/core/admin/schedule';
import type {AdminResource} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {localize, type Messages} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import {Icon} from '@/components/Icon';
import {Pressable, Text, View} from 'react-native';

import {AdminPage} from '@/admin/AdminPage';
import {Gone} from '@/admin/Gone';
import {KindForm} from '@/admin/KindForm';
import {useAdminLocation} from '@/admin/location';
import {ResourceDetail} from '@/admin/ResourceDetail';
import {ResourceForm} from '@/admin/ResourceForm';
import {ScheduleForm} from '@/admin/ScheduleForm';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

// What a row says besides the current times: a change or closing ahead.
function statusOf(
  resource: AdminResource,
  today: string,
  t: Messages,
): string | null {
  if (resource.closesFrom !== null) {
    return resource.closesFrom <= today
      ? t.admin.resources.closed
      : t.rules.closes(formatDayMonth(resource.closesFrom, t));
  }

  const next = resource.schedules[1];
  return next
    ? t.admin.resources.newTimes(formatDayMonth(next.validFrom, t))
    : null;
}

function ResourceRow({
  resource,
  status,
  onPress,
  last,
}: {
  resource: AdminResource;
  status: string | null;
  onPress: () => void;
  last: boolean;
}) {
  const t = useMessages();
  const {locale} = useLocale();
  const {locales} = useAdminAccount();
  const current = resource.schedules[0];
  const missing =
    missingLanguages(resource.name, locales, t) ??
    missingLanguages(resource.tags, locales, t);

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-[18px] py-3.5 active:bg-theme-sunk ${
        last ? '' : 'border-b border-theme-line'
      }`}
    >
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text
          numberOfLines={1}
          className='text-[15px] font-semibold tracking-tight text-theme-ink'
        >
          {localize(resource.name, locale)}
        </Text>
        <Text className='font-sans text-[13px] text-theme-muted'>
          {current ? slotsText(current.slots) : t.admin.resources.noSlots}
        </Text>
        {status ? (
          <Text className='font-sans text-xs text-theme-accent'>{status}</Text>
        ) : null}
        {missing ? (
          <Text className='font-sans text-xs text-theme-accent'>
            {t.admin.localized.untranslated(missing)}
          </Text>
        ) : null}
      </View>
      <Icon name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
  );
}

export function AdminResources() {
  const {organizationName, locales} = useAdminAccount();
  const t = useMessages();
  const {locale} = useLocale();
  const {data, error, loading, reload} = useFocusLoad(adminLoad.resources);
  const showSkeleton = useSlowLoad(data === null && error === null);
  const {location, open, up} = useAdminLocation('resources');

  const refreshAccount = useRefreshAccount();

  // What lacks a language is counted on the account, so it follows every
  // change here.
  const changed = () => {
    reload();
    refreshAccount();
  };
  const actions = useAdminActions(changed);
  const toList = {label: t.tabs.resources, onPress: up};
  // A step opened by its address has no list to fall back on.
  const failed =
    error && !data ? (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    ) : null;

  if (location.step === 'new-kind') {
    return (
      <AdminPage
        title={t.admin.resources.newKind}
        subtitle={organizationName}
        back={toList}
      >
        <KindForm
          initial={{name: {}, maxActive: 1}}
          submitLabel={t.admin.add}
          onCancel={up}
          onSubmit={async (fields) => {
            await actions.kinds.create(fields);
            up();
          }}
        />
      </AdminPage>
    );
  }

  if (location.step === 'kind') {
    const editedKind = data?.kinds.find((kind) => kind.id === location.id);
    const inUse = data?.resources.some(
      (resource) => resource.kindId === location.id,
    );

    return (
      <AdminPage
        title={
          editedKind
            ? (localize(editedKind.name, locale) ?? '')
            : data && !loading
              ? t.admin.goneTitle
              : ''
        }
        subtitle={organizationName}
        back={toList}
      >
        {editedKind ? (
          <KindForm
            initial={editedKind}
            submitLabel={t.admin.save}
            onCancel={up}
            onSubmit={async (fields) => {
              await actions.kinds.update(editedKind.id, fields);
              up();
            }}
            onDelete={
              inUse
                ? undefined
                : () => void actions.kinds.remove(editedKind.id, up)
            }
          />
        ) : data && !loading ? (
          <Gone />
        ) : (
          failed
        )}
      </AdminPage>
    );
  }

  if (location.step === 'new') {
    return (
      <AdminPage
        title={t.admin.resources.newResource}
        subtitle={organizationName}
        back={toList}
      >
        {data ? (
          <ResourceForm
            kinds={data.kinds}
            initial={{
              name: {},
              kindId: data.kinds[0]?.id ?? '',
              tags: {},
              slots: [{start: '08:00', end: '11:00', endOffsetDays: 0}],
            }}
            withSlots
            submitLabel={t.admin.add}
            onCancel={up}
            onSubmit={async (fields) => {
              const {id} = await actions.resources.create(fields);
              open({tab: 'resources', step: 'resource', id}, {replace: true});
            }}
          />
        ) : (
          failed
        )}
      </AdminPage>
    );
  }

  if ('id' in location) {
    const {id} = location;
    const opened = data?.resources.find((resource) => resource.id === id);
    const name = opened ? (localize(opened.name, locale) ?? '') : '';
    let content = null;

    if (data && opened && location.step === 'edit') {
      content = (
        <ResourceForm
          kinds={data.kinds}
          initial={{...opened, slots: []}}
          withSlots={false}
          submitLabel={t.admin.save}
          onCancel={up}
          onSubmit={async (fields) => {
            await actions.resources.update(opened.id, fields);
            up();
          }}
        />
      );
    } else if (data && opened && location.step === 'schedule') {
      content = (
        <ScheduleForm
          initial={opened.schedules.at(-1)?.slots ?? []}
          validFrom={data.earliestChange}
          onCancel={up}
          onSubmit={async (slots) => {
            await actions.resources.saveSchedule(
              opened.id,
              data.earliestChange,
              slots,
            );
            up();
          }}
        />
      );
    } else if (data && opened) {
      content = (
        <ResourceDetail
          key={opened.id}
          resource={opened}
          data={data}
          onChanged={changed}
          onEdit={() => open({tab: 'resources', step: 'edit', id})}
          onSchedule={() => open({tab: 'resources', step: 'schedule', id})}
        />
      );
    }
    const gone = !opened && data !== null && !loading;

    return (
      <AdminPage
        title={
          gone
            ? t.admin.goneTitle
            : location.step === 'edit'
              ? t.admin.editDetails
              : location.step === 'schedule'
                ? t.admin.resource.editTimes
                : name
        }
        subtitle={organizationName}
        back={
          location.step === 'resource'
            ? toList
            : {label: name || t.tabs.resources, onPress: up}
        }
      >
        {gone ? <Gone /> : (content ?? failed)}
      </AdminPage>
    );
  }

  let body = null;
  if (data) {
    body = (
      <View className='gap-[26px]'>
        {data.kinds.length === 0 ? (
          <Text className='font-sans text-sm leading-5 text-theme-muted'>
            {t.admin.resources.startWithKind}
          </Text>
        ) : null}
        {data.kinds.map((kind) => {
          const own = data.resources.filter(
            (resource) => resource.kindId === kind.id,
          );
          const missing = missingLanguages(kind.name, locales, t);

          return (
            <View key={kind.id}>
              <View className='mb-2.5 ml-0.5 flex-row items-baseline justify-between gap-3'>
                <Text className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
                  {localize(kind.name, locale)}
                </Text>
                <Pressable
                  onPress={() =>
                    open({tab: 'resources', step: 'kind', id: kind.id})
                  }
                  hitSlop={8}
                  className='active:opacity-60'
                >
                  <Text className='font-sans text-xs text-theme-muted'>
                    {missing ? (
                      <Text className='text-theme-accent'>
                        {t.admin.localized.untranslated(missing)} ·{' '}
                      </Text>
                    ) : null}
                    {limitText(kind, t)} · {t.admin.resources.edit}
                  </Text>
                </Pressable>
              </View>
              {own.length === 0 ? (
                <Text className='ml-0.5 font-sans text-[13px] text-theme-muted'>
                  {t.admin.resources.noneOfKind}
                </Text>
              ) : (
                <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {own.map((resource, index) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      status={statusOf(resource, data.today, t)}
                      last={index === own.length - 1}
                      onPress={() =>
                        open({
                          tab: 'resources',
                          step: 'resource',
                          id: resource.id,
                        })
                      }
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
          {Array.from({length: 3}, (_, index) => (
            <SkeletonBar key={index} className='h-20 w-full rounded-2xl' />
          ))}
        </View>
      </Skeleton>
    );
  }

  const hasKinds = (data?.kinds.length ?? 0) > 0;

  return (
    <AdminPage
      title={t.tabs.resources}
      subtitle={organizationName}
      action={
        data ? (
          <View className='flex-row flex-wrap gap-2.5'>
            {hasKinds ? (
              <Pressable
                onPress={() => open({tab: 'resources', step: 'new'})}
                className={PRIMARY_BUTTON}
              >
                <Icon name='add' size={18} color={theme.surface} />
                <Text className={PRIMARY_LABEL}>
                  {t.admin.resources.newResource}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => open({tab: 'resources', step: 'new-kind'})}
              className={hasKinds ? SECONDARY_BUTTON : PRIMARY_BUTTON}
            >
              <Icon
                name='add'
                size={18}
                color={hasKinds ? theme.ink : theme.surface}
              />
              <Text className={hasKinds ? SECONDARY_LABEL : PRIMARY_LABEL}>
                {t.admin.resources.newKind}
              </Text>
            </Pressable>
          </View>
        ) : null
      }
    >
      {body}
    </AdminPage>
  );
}
