import {missingLanguages} from '@booking/core/admin/localized';
import {codeOf, errorMessage} from '@booking/core/api/errors';
import type {AdminAnnouncement} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {localize, type Messages} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import {useState} from 'react';

import {useAdminAccount, useRefreshAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {AnnouncementForm} from '@/admin/AnnouncementForm';
import {PRIMARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap} from '@/api/client';
import {useDialog} from '@/components/Dialog';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

function fetchAnnouncements() {
  return unwrap(api.GET('/admin/announcements'));
}

type Screen = {kind: 'list'} | {kind: 'add'} | {kind: 'edit'; id: string};

const GROUPS = [
  {status: 'active', label: (t: Messages) => t.admin.announcements.active},
  {
    status: 'scheduled',
    label: (t: Messages) => t.admin.announcements.scheduled,
  },
  {status: 'ended', label: (t: Messages) => t.admin.announcements.ended},
] as const;

function periodOf(announcement: AdminAnnouncement, t: Messages): string {
  const from = formatDayMonth(announcement.publishedOn, t);

  return announcement.endsOn
    ? t.admin.announcements.period(from, formatDayMonth(announcement.endsOn, t))
    : t.admin.announcements.openPeriod(from);
}

export function AdminAnnouncements() {
  const {organizationName, locales} = useAdminAccount();
  const t = useMessages();
  const {locale} = useLocale();
  const dialog = useDialog();
  const {data, error, reload} = useFocusLoad(fetchAnnouncements);
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
  const back = {label: t.tabs.announcements, onPress: toList};

  if (data && screen.kind === 'add') {
    return (
      <AdminPage
        title={t.admin.announcements.new}
        subtitle={organizationName}
        back={back}
      >
        <AnnouncementForm
          initial={{
            title: {},
            body: {},
            publishedOn: data.today,
            endsOn: null,
          }}
          today={data.today}
          submitLabel={t.admin.announcements.publish}
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(api.POST('/admin/announcements', {body: fields}));
            changed();
            toList();
          }}
        />
      </AdminPage>
    );
  }

  const edited =
    screen.kind === 'edit'
      ? data?.announcements.find(
          (announcement) => announcement.id === screen.id,
        )
      : undefined;

  if (data && edited) {
    const title = localize(edited.title, locale) ?? '';

    return (
      <AdminPage title={title} subtitle={organizationName} back={back}>
        <AnnouncementForm
          key={edited.id}
          initial={edited}
          today={data.today}
          submitLabel={t.admin.save}
          onCancel={toList}
          onSubmit={async (fields) => {
            await unwrap(
              api.PUT('/admin/announcements/{id}', {
                params: {path: {id: edited.id}},
                body: fields,
              }),
            );
            changed();
            toList();
          }}
          onDelete={() =>
            dialog.confirm(
              t.admin.announcements.remove,
              t.admin.announcements.removeQuestion(title),
              {
                label: t.admin.remove,
                onPress: () => {
                  unwrap(
                    api.DELETE('/admin/announcements/{id}', {
                      params: {path: {id: edited.id}},
                    }),
                  )
                    .then(() => {
                      changed();
                      toList();
                    })
                    .catch((caught: unknown) =>
                      dialog.alert(
                        t.admin.announcements.removeFailed,
                        errorMessage(codeOf(caught), t),
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
      data.announcements.length === 0 ? (
        <p className='text-sm leading-5 text-theme-muted'>
          {t.admin.announcements.none}
        </p>
      ) : (
        <div className='flex flex-col gap-6.5'>
          {GROUPS.map(({status, label}) => {
            const own = data.announcements.filter(
              (item) => item.status === status,
            );

            if (own.length === 0) {
              return null;
            }

            return (
              <section key={status}>
                <h2 className={SECTION_LABEL}>{label(t)}</h2>
                <div className='flex flex-col divide-y divide-theme-line overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {own.map((announcement) => {
                    const missing =
                      missingLanguages(announcement.title, locales, t) ??
                      missingLanguages(announcement.body, locales, t);

                    return (
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
                            {localize(announcement.title, locale)}
                          </span>
                          <span className='truncate text-[13px] text-theme-muted'>
                            {periodOf(announcement, t)}
                          </span>
                          {missing ? (
                            <span className='text-xs text-theme-accent'>
                              {t.admin.localized.untranslated(missing)}
                            </span>
                          ) : null}
                        </span>
                        <ChevronForwardIcon
                          size={16}
                          className='shrink-0 text-theme-faint'
                        />
                      </button>
                    );
                  })}
                </div>
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
            <SkeletonBar key={index} className='h-16 w-full rounded-2xl' />
          ))}
        </div>
      </Skeleton>
    );
  }

  return (
    <AdminPage
      title={t.tabs.announcements}
      subtitle={organizationName}
      action={
        <button
          type='button'
          onClick={() => setScreen({kind: 'add'})}
          className={PRIMARY_BUTTON}
        >
          <AddIcon size={18} />
          {t.admin.announcements.new}
        </button>
      }
    >
      {body}
    </AdminPage>
  );
}
