import {useState} from 'react';

import {useAdminAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {KindForm} from '@/admin/KindForm';
import {ResourceDetail} from '@/admin/ResourceDetail';
import {ResourceForm} from '@/admin/ResourceForm';
import {limitText, slotsText} from '@/admin/schedule';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {api, unwrap, type AdminResource} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {useDialog} from '@/components/Dialog';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {formatDayMonth} from '@/lib/dates';

function fetchResources() {
  return unwrap(api.GET('/admin/resources'));
}

type Screen =
  | {kind: 'list'}
  | {kind: 'add-resource'}
  | {kind: 'add-kind'}
  | {kind: 'edit-kind'; id: string}
  | {kind: 'resource'; id: string};

// What a row says besides the current times: a change or closing ahead.
function statusOf(resource: AdminResource, today: string): string | null {
  if (resource.closesFrom !== null) {
    return resource.closesFrom <= today
      ? 'Stängd'
      : `Stängs ${formatDayMonth(resource.closesFrom)}`;
  }

  const next = resource.schedules[1];
  return next ? `Nya tider ${formatDayMonth(next.validFrom)}` : null;
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
  const current = resource.schedules[0];

  return (
    <button
      type='button'
      onClick={onPress}
      className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
    >
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='truncate text-[15px] font-semibold tracking-tight text-theme-ink'>
          {resource.name}
        </span>
        <span className='truncate text-[13px] tabular-nums text-theme-muted'>
          {current ? slotsText(current.slots) : 'Inga pass'}
        </span>
        {status ? (
          <span className='text-xs text-theme-accent'>{status}</span>
        ) : null}
      </span>
      <ChevronForwardIcon size={16} className='shrink-0 text-theme-faint' />
    </button>
  );
}

export function AdminResources() {
  const {organizationName} = useAdminAccount();
  const dialog = useDialog();
  const {data, error, reload} = useFocusLoad(fetchResources);
  const showSkeleton = useSlowLoad(data === null && error === null);
  const [screen, setScreen] = useState<Screen>({kind: 'list'});

  const toList = () => setScreen({kind: 'list'});
  const back = {label: 'Resurser', onPress: toList};

  if (data && screen.kind === 'add-kind') {
    return (
      <AdminPage title='Ny typ' subtitle={organizationName} back={back}>
        <KindForm
          initial={{name: '', maxActive: 1}}
          submitLabel='Lägg till'
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(api.POST('/admin/kinds', {body: fields}));
            reload();
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
        title={editedKind.name}
        subtitle={organizationName}
        back={back}
      >
        <KindForm
          initial={editedKind}
          submitLabel='Spara'
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(
              api.PATCH('/admin/kinds/{id}', {
                params: {path: {id: editedKind.id}},
                body: fields,
              }),
            );
            reload();
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
                      reload();
                      toList();
                    })
                    .catch((caught: unknown) =>
                      dialog.alert(
                        'Kunde inte ta bort typen',
                        errorMessage(codeOf(caught)),
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
      <AdminPage title='Ny resurs' subtitle={organizationName} back={back}>
        <ResourceForm
          kinds={data.kinds}
          initial={{
            name: '',
            kindId: data.kinds[0]?.id ?? '',
            tags: [],
            slots: [{start: '08:00', end: '11:00', endOffsetDays: 0}],
          }}
          withSlots
          submitLabel='Lägg till'
          onCancel={toList}
          onSubmit={async (fields) => {
            const {id} = await unwrap(
              api.POST('/admin/resources', {body: fields}),
            );
            reload();
            setScreen({kind: 'resource', id});
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
      <AdminPage title={opened.name} subtitle={organizationName} back={back}>
        <ResourceDetail
          key={opened.id}
          resource={opened}
          data={data}
          onChanged={reload}
        />
      </AdminPage>
    );
  }

  let body = null;
  if (data) {
    body = (
      <div className='flex flex-col gap-6.5'>
        {data.kinds.length === 0 ? (
          <p className='text-sm leading-5 text-theme-muted'>
            Börja med en typ, som Tvätt eller Bastu. Typen bestämmer hur många
            bokningar en lägenhet får ha åt gången.
          </p>
        ) : null}
        {data.kinds.map((kind) => {
          const own = data.resources.filter(
            (resource) => resource.kindId === kind.id,
          );

          return (
            <section key={kind.id}>
              <div className='mb-2.5 ml-0.5 flex items-baseline justify-between gap-3'>
                <h2 className='text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
                  {kind.name}
                </h2>
                <button
                  type='button'
                  onClick={() => setScreen({kind: 'edit-kind', id: kind.id})}
                  className='text-xs text-theme-muted transition-colors hover:text-theme-ink'
                >
                  {limitText(kind)} · Ändra
                </button>
              </div>
              {own.length === 0 ? (
                <p className='ml-0.5 text-[13px] text-theme-muted'>
                  Inga resurser av den här typen.
                </p>
              ) : (
                <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {own.map((resource) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      status={statusOf(resource, data.today)}
                      onPress={() =>
                        setScreen({kind: 'resource', id: resource.id})
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
      <Notice message={error} actionLabel='Försök igen' onAction={reload} />
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
      title='Resurser'
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
                Ny resurs
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
              Ny typ
            </button>
          </div>
        ) : null
      }
    >
      {body}
    </AdminPage>
  );
}
