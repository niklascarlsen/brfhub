import {missingLanguages} from '@booking/core/admin/localized';
import {limitText, slotsText} from '@booking/core/admin/schedule';
import {codeOf, errorMessage} from '@booking/core/api/errors';
import type {AdminResource} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {localize, type Messages} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import {useState} from 'react';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {KindForm} from '@/admin/KindForm';
import {ResourceDetail} from '@/admin/ResourceDetail';
import {ResourceForm} from '@/admin/ResourceForm';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {api, unwrap} from '@/api/client';
import {useDialog} from '@/components/Dialog';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

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
}: {
  resource: AdminResource;
  status: string | null;
  onPress: () => void;
}) {
  const t = useMessages();
  const {locale} = useLocale();
  const {locales} = useAdminAccount();
  const current = resource.schedules[0];
  const missing =
    missingLanguages(resource.name, locales, t) ??
    missingLanguages(resource.tags, locales, t);

  return (
    <button
      type='button'
      onClick={onPress}
      className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
    >
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='truncate text-[15px] font-semibold tracking-tight text-theme-ink'>
          {localize(resource.name, locale)}
        </span>
        <span className='text-[13px] leading-5 tabular-nums text-theme-muted'>
          {current ? slotsText(current.slots) : t.admin.resources.noSlots}
        </span>
        {status ? (
          <span className='text-xs text-theme-accent'>{status}</span>
        ) : null}
        {missing ? (
          <span className='text-xs text-theme-accent'>
            {t.admin.localized.untranslated(missing)}
          </span>
        ) : null}
      </span>
      <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
    </button>
  );
}

export function AdminResources() {
  const {organizationName, locales} = useAdminAccount();
  const t = useMessages();
  const {locale} = useLocale();
  const dialog = useDialog();
  const {data, error, reload} = useFocusLoad(fetchResources);
  const showSkeleton = useSlowLoad(data === null && error === null);
  const [screen, setScreen] = useState<Screen>({kind: 'list'});

  const refreshAccount = useRefreshAccount();
  const toList = () => setScreen({kind: 'list'});

  // What lacks a language is counted on the account, so it follows every
  // change here.
  const changed = () => {
    reload();
    refreshAccount();
  };
  const back = {label: t.tabs.resources, onPress: toList};

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
                      dialog.alert(
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
      <div className='flex flex-col gap-6.5'>
        {data.kinds.length === 0 ? (
          <p className='text-sm leading-5 text-theme-muted'>
            {t.admin.resources.startWithKind}
          </p>
        ) : null}
        {data.kinds.map((kind) => {
          const own = data.resources.filter(
            (resource) => resource.kindId === kind.id,
          );
          const missing = missingLanguages(kind.name, locales, t);

          return (
            <section key={kind.id}>
              <div className='mb-2.5 ml-0.5 flex items-baseline justify-between gap-3'>
                <h2 className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
                  {localize(kind.name, locale)}
                </h2>
                <button
                  type='button'
                  onClick={() => setScreen({kind: 'edit-kind', id: kind.id})}
                  className='text-xs text-theme-muted transition-colors hover:text-theme-ink'
                >
                  {missing ? (
                    <span className='text-theme-accent'>
                      {t.admin.localized.untranslated(missing)} ·{' '}
                    </span>
                  ) : null}
                  {limitText(kind, t)} · {t.admin.resources.edit}
                </button>
              </div>
              {own.length === 0 ? (
                <p className='ml-0.5 text-[13px] text-theme-muted'>
                  {t.admin.resources.noneOfKind}
                </p>
              ) : (
                <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {own.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      status={statusOf(resource, data.today, t)}
                      onPress={() =>
                        setScreen({
                          kind: 'resource',
                          id: resource.id,
                          name: localize(resource.name, locale) ?? '',
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  } else if (showSkeleton) {
    body = (
      <Skeleton>
        <div className='flex flex-col gap-3'>
          {Array.from({length: 3}, (_, index) => (
            <SkeletonBar key={index} className='h-20 w-full rounded-2xl' />
          ))}
        </div>
      </Skeleton>
    );
  }

  return (
    <AdminPage
      title={t.tabs.resources}
      subtitle={organizationName}
      action={
        data ? (
          <div className='flex flex-wrap gap-2.5'>
            {data.kinds.length > 0 ? (
              <button
                type='button'
                onClick={() => setScreen({kind: 'add-resource'})}
                className={PRIMARY_BUTTON}
              >
                <AddIcon size={18} />
                {t.admin.resources.newResource}
              </button>
            ) : null}
            <button
              type='button'
              onClick={() => setScreen({kind: 'add-kind'})}
              className={
                data.kinds.length > 0 ? SECONDARY_BUTTON : PRIMARY_BUTTON
              }
            >
              <AddIcon size={18} />
              {t.admin.resources.newKind}
            </button>
          </div>
        ) : null
      }
    >
      {body}
    </AdminPage>
  );
}
