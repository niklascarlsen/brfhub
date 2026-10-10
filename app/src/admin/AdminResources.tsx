import Ionicons from '@expo/vector-icons/Ionicons';
import {useIsFocused} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import {Alert, BackHandler, Pressable, Text, View} from 'react-native';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {KindForm} from '@/admin/KindForm';
import {missingLanguages} from '@/admin/localized';
import {ResourceDetail} from '@/admin/ResourceDetail';
import {ResourceForm} from '@/admin/ResourceForm';
import {useConfirmLeave} from '@/admin/unsaved';
import {limitText, slotsText} from '@/admin/schedule';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {api, unwrap, type AdminResource} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {localize, type Messages} from '@/i18n/catalog';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import {formatDayMonth} from '@/lib/dates';
import theme from '@/theme.json';

function fetchResources() {
  return unwrap(api.GET('/admin/resources'));
}

type Screen =
  | {kind: 'list'}
  | {kind: 'add-resource'}
  | {kind: 'add-kind'}
  | {kind: 'edit-kind'; id: string}
  | {kind: 'resource'; id: string; name: string};

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
      <Ionicons name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
  );
}

export function AdminResources() {
  const {organizationName, locales} = useAdminAccount();
  const t = useMessages();
  const {locale} = useLocale();
  const {data, error, reload} = useFocusLoad(fetchResources);
  const showSkeleton = useSlowLoad(data === null && error === null);
  const [screen, setScreen] = useState<Screen>({kind: 'list'});
  const refreshAccount = useRefreshAccount();
  const confirmLeave = useConfirmLeave();
  // Every tab keeps its screen, so only the one shown answers the back
  // button.
  const focused = useIsFocused();

  // What lacks a language is counted on the account, so it follows every
  // change here.
  const changed = () => {
    reload();
    refreshAccount();
  };

  const toList = () => setScreen({kind: 'list'});
  const back = {label: t.tabs.resources, onPress: toList};

  // The steps below the list are not screens of their own, so Android's
  // back button would otherwise leave the tab instead of going back.
  useEffect(() => {
    if (screen.kind === 'list' || !focused) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        confirmLeave(() => setScreen({kind: 'list'}));
        return true;
      },
    );

    return () => subscription.remove();
  }, [screen.kind, focused, confirmLeave]);

  if (data && screen.kind === 'add-kind') {
    return (
      <AdminPage
        title={t.admin.resources.newKind}
        subtitle={organizationName}
        back={back}
      >
        <KindForm
          initial={{name: {}, maxActive: 1}}
          submitLabel={t.admin.add}
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(api.POST('/admin/kinds', {body: fields}));
            changed();
            toList();
          }}
        />
      </AdminPage>
    );
  }

  const editedKind =
    screen.kind === 'edit-kind'
      ? data?.kinds.find((kind) => kind.id === screen.id)
      : undefined;

  if (data && editedKind) {
    const inUse = data.resources.some(
      (resource) => resource.kindId === editedKind.id,
    );

    return (
      <AdminPage
        title={localize(editedKind.name, locale) ?? ''}
        subtitle={organizationName}
        back={back}
      >
        <KindForm
          initial={editedKind}
          submitLabel={t.admin.save}
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(
              api.PATCH('/admin/kinds/{id}', {
                params: {path: {id: editedKind.id}},
                body: fields,
              }),
            );
            changed();
            toList();
          }}
          onDelete={
            inUse
              ? undefined
              : () => {
                  unwrap(
                    api.DELETE('/admin/kinds/{id}', {
                      params: {path: {id: editedKind.id}},
                    }),
                  )
                    .then(() => {
                      changed();
                      toList();
                    })
                    .catch((caught: unknown) =>
                      Alert.alert(
                        t.admin.resources.removeKindFailed,
                        errorMessage(codeOf(caught), t),
                      ),
                    );
                }
          }
        />
      </AdminPage>
    );
  }

  if (data && screen.kind === 'add-resource') {
    return (
      <AdminPage
        title={t.admin.resources.newResource}
        subtitle={organizationName}
        back={back}
      >
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
          onCancel={toList}
          onSubmit={async (fields) => {
            const {id} = await unwrap(
              api.POST('/admin/resources', {body: fields}),
            );
            changed();
            setScreen({
              kind: 'resource',
              id,
              name: localize(fields.name, locale) ?? '',
            });
          }}
        />
      </AdminPage>
    );
  }

  const opened =
    screen.kind === 'resource'
      ? data?.resources.find((resource) => resource.id === screen.id)
      : undefined;

  if (data && opened) {
    return (
      <AdminPage
        title={localize(opened.name, locale) ?? ''}
        subtitle={organizationName}
        back={back}
      >
        <ResourceDetail
          key={opened.id}
          resource={opened}
          data={data}
          onChanged={changed}
        />
      </AdminPage>
    );
  }

  // A resource just added shows under its name until the list that has it
  // arrives, instead of the list flashing by.
  if (screen.kind === 'resource') {
    return (
      <AdminPage title={screen.name} subtitle={organizationName} back={back}>
        {null}
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
                  onPress={() => setScreen({kind: 'edit-kind', id: kind.id})}
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
                        setScreen({
                          kind: 'resource',
                          id: resource.id,
                          name: localize(resource.name, locale) ?? '',
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
                onPress={() => setScreen({kind: 'add-resource'})}
                className={PRIMARY_BUTTON}
              >
                <Ionicons name='add' size={18} color={theme.surface} />
                <Text className={PRIMARY_LABEL}>
                  {t.admin.resources.newResource}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setScreen({kind: 'add-kind'})}
              className={hasKinds ? SECONDARY_BUTTON : PRIMARY_BUTTON}
            >
              <Ionicons
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
