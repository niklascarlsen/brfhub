import {useState} from 'react';

import {useAdminAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {AnnouncementForm} from '@/admin/AnnouncementForm';
import {PRIMARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap, type AdminAnnouncement} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {useDialog} from '@/components/Dialog';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {formatDayMonth, toIsoDate} from '@/lib/dates';

function fetchAnnouncements() {
  return unwrap(api.GET('/admin/announcements'));
}

type Screen = {kind: 'list'} | {kind: 'add'} | {kind: 'edit'; id: string};

const GROUPS = [
  {status: 'active', label: 'Visas nu'},
  {status: 'scheduled', label: 'Kommande'},
  {status: 'ended', label: 'Avslutade'},
] as const;

function periodOf(announcement: AdminAnnouncement): string {
  const from = formatDayMonth(announcement.publishedOn);

  return announcement.endsOn
    ? `${from} till ${formatDayMonth(announcement.endsOn)}`
    : `Från ${from}, tills vidare`;
}

export function AdminAnnouncements() {
  const {organizationName} = useAdminAccount();
  const dialog = useDialog();
  const {data, error, reload} = useFocusLoad(fetchAnnouncements);
  const showSkeleton = useSlowLoad(data === null && error === null);
  const [screen, setScreen] = useState<Screen>({kind: 'list'});

  const toList = () => setScreen({kind: 'list'});
  const back = {label: 'Anslag', onPress: toList};

  if (screen.kind === 'add') {
    return (
      <AdminPage title='Nytt anslag' subtitle={organizationName} back={back}>
        <AnnouncementForm
          initial={{
            title: '',
            body: '',
            publishedOn: toIsoDate(new Date()),
            endsOn: null,
          }}
          submitLabel='Publicera'
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(api.POST('/admin/announcements', {body: fields}));
            reload();
            toList();
          }}
        />
      </AdminPage>
    );
  }

  const edited =
    screen.kind === 'edit'
      ? data?.find((announcement) => announcement.id === screen.id)
      : undefined;

  if (edited) {
    return (
      <AdminPage title={edited.title} subtitle={organizationName} back={back}>
        <AnnouncementForm
          key={edited.id}
          initial={edited}
          submitLabel='Spara'
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(
              api.PUT('/admin/announcements/{id}', {
                params: {path: {id: edited.id}},
                body: fields,
              }),
            );
            reload();
            toList();
          }}
          onDelete={() =>
            dialog.confirm(
              'Ta bort anslaget',
              `”${edited.title}” tas bort och visas inte längre.`,
              {
                label: 'Ta bort',
                onPress: () => {
                  unwrap(
                    api.DELETE('/admin/announcements/{id}', {
                      params: {path: {id: edited.id}},
                    }),
                  )
                    .then(() => {
                      reload();
                      toList();
                    })
                    .catch((caught: unknown) =>
                      dialog.alert(
                        'Kunde inte ta bort anslaget',
                        errorMessage(codeOf(caught)),
                      ),
                    );
                },
              },
            )
          }
        />
      </AdminPage>
    );
  }

  let body = null;
  if (data) {
    body =
      data.length === 0 ? (
        <p className='text-sm leading-5 text-theme-muted'>
          Inga anslag än. Ett anslag visas överst för alla lägenheter, till
          exempel om en städdag eller ett stopp i tvättstugan.
        </p>
      ) : (
        <div className='flex flex-col gap-6.5'>
          {GROUPS.map(({status, label}) => {
            const own = data.filter((item) => item.status === status);

            if (own.length === 0) {
              return null;
            }

            return (
              <section key={status}>
                <h2 className={SECTION_LABEL}>{label}</h2>
                <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {own.map((announcement) => (
                    <button
                      key={announcement.id}
                      type='button'
                      onClick={() =>
                        setScreen({kind: 'edit', id: announcement.id})
                      }
                      className='flex w-full items-center gap-3 px-4.5 py-3.5 text-left transition-colors hover:bg-theme-sunk'
                    >
                      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
                        <span className='truncate text-[15px] font-semibold tracking-tight text-theme-ink'>
                          {announcement.title}
                        </span>
                        <span className='truncate text-[13px] text-theme-muted'>
                          {periodOf(announcement)}
                        </span>
                      </span>
                      <ChevronForwardIcon
                        size={16}
                        className='shrink-0 text-theme-faint'
                      />
                    </button>
                  ))}
                </div>
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
            <SkeletonBar key={index} className='h-16 w-full rounded-2xl' />
          ))}
        </div>
      </Skeleton>
    );
  }

  return (
    <AdminPage
      title='Anslag'
      subtitle={organizationName}
      action={
        <button
          type='button'
          onClick={() => setScreen({kind: 'add'})}
          className={PRIMARY_BUTTON}
        >
          <AddIcon size={18} />
          Nytt anslag
        </button>
      }
    >
      {body}
    </AdminPage>
  );
}
