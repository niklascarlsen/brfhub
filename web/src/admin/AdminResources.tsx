import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import {missingLanguages} from '@booking/core/admin/localized';
import {limitText, slotsText} from '@booking/core/admin/schedule';
import type {AdminResource} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {localize, type Messages} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';

import {AdminPage} from '@/admin/AdminPage';
import {CloseForm} from '@/admin/CloseForm';
import {Gone} from '@/admin/Gone';
import {KindForm} from '@/admin/KindForm';
import {useAdminLocation} from '@/admin/location';
import {ResourceDetail} from '@/admin/ResourceDetail';
import {ResourceForm} from '@/admin/ResourceForm';
import {ScheduleForm} from '@/admin/ScheduleForm';
import {LIST, PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

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
            inUse={inUse}
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
          today={data.today}
          freeFrom={opened.freeFrom}
          onCancel={up}
          onSubmit={async (validFrom, {slots, reason}) => {
            const saved = await actions.resources.saveSchedule(
              opened.id,
              validFrom,
              slots,
              reason,
            );
            if (saved) {
              up();
            }
            return saved;
          }}
        />
      );
    } else if (data && opened && location.step === 'close') {
      content = (
        <CloseForm
          name={name}
          today={data.today}
          freeFrom={opened.freeFrom}
          onCancel={up}
          onSubmit={async (closesFrom, reason) => {
            const closed = await actions.resources.close(
              opened.id,
              closesFrom,
              reason,
            );
            if (closed) {
              up();
            }
            return closed;
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
          onClose={() => open({tab: 'resources', step: 'close', id})}
          onRemoved={up}
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
                : location.step === 'close'
                  ? t.admin.resource.close
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
                  onClick={() =>
                    open({tab: 'resources', step: 'kind', id: kind.id})
                  }
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
                <div className={LIST}>
                  {own.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      status={statusOf(resource, data.today, t)}
                      onPress={() =>
                        open({
                          tab: 'resources',
                          step: 'resource',
                          id: resource.id,
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
            <SkeletonBar key={index} className='h-20 w-full rounded-card' />
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
                onClick={() => open({tab: 'resources', step: 'new'})}
                className={PRIMARY_BUTTON}
              >
                <AddIcon size={18} />
                {t.admin.resources.newResource}
              </button>
            ) : null}
            <button
              type='button'
              onClick={() => open({tab: 'resources', step: 'new-kind'})}
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
