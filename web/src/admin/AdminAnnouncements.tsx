import {ENDED_SHOWN} from '@booking/core/admin/announcement';
import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import {missingLanguages} from '@booking/core/admin/localized';
import type {AdminAnnouncement} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {localize, type Messages} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import {useState} from 'react';

import {AdminPage} from '@/admin/AdminPage';
import {AnnouncementForm} from '@/admin/AnnouncementForm';
import {Gone} from '@/admin/Gone';
import {useAdminLocation} from '@/admin/location';
import {LIST, PRIMARY_BUTTON, SECTION_LABEL} from '@/admin/styles';
import {AddIcon, ChevronForwardIcon} from '@/components/icons';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

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
  const {data, error, loading, reload} = useFocusLoad(adminLoad.announcements);
  const showSkeleton = useSlowLoad(data === null && error === null);
  const {location, open, up} = useAdminLocation('announcements');
  const [allEnded, setAllEnded] = useState(false);

  const refreshAccount = useRefreshAccount();

  // What lacks a language is counted on the account, so it follows every
  // change here.
  const actions = useAdminActions(() => {
    reload();
    refreshAccount();
  });
  const back = {label: t.tabs.announcements, onPress: up};
  // A step opened by its address has no list to fall back on.
  const failed =
    error && !data ? (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    ) : null;

  if (location.step === 'new') {
    return (
      <AdminPage
        title={t.admin.announcements.new}
        subtitle={organizationName}
        back={back}
      >
        {data ? (
          <AnnouncementForm
            initial={{
              title: {},
              body: {},
              publishedOn: data.today,
              endsOn: null,
            }}
            today={data.today}
            submitLabel={t.admin.announcements.publish}
            onCancel={up}
            onSubmit={async (fields) => {
              await actions.announcements.create(fields);
              up();
            }}
          />
        ) : (
          failed
        )}
      </AdminPage>
    );
  }

  if (location.step === 'announcement') {
    const edited = data?.announcements.find(
      (announcement) => announcement.id === location.id,
    );
    const title = edited ? (localize(edited.title, locale) ?? '') : '';
    const gone = !edited && data !== null && !loading;

    return (
      <AdminPage
        title={gone ? t.admin.goneTitle : title}
        subtitle={organizationName}
        back={back}
      >
        {data && edited ? (
          <AnnouncementForm
            key={edited.id}
            initial={edited}
            today={data.today}
            submitLabel={t.admin.save}
            onCancel={up}
            onSubmit={async (fields) => {
              await actions.announcements.update(edited.id, fields);
              up();
            }}
            onDelete={() =>
              actions.announcements.confirmRemove(edited.id, title, up)
            }
          />
        ) : gone ? (
          <Gone />
        ) : (
          failed
        )}
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

            const listed =
              status === 'ended' && !allEnded ? own.slice(0, ENDED_SHOWN) : own;

            return (
              <section key={status}>
                <h2 className={SECTION_LABEL}>{label(t)}</h2>
                <div className={LIST}>
                  {listed.map((announcement) => {
                    const missing =
                      missingLanguages(announcement.title, locales, t) ??
                      missingLanguages(announcement.body, locales, t);

                    return (
                      <button
                        key={announcement.id}
                        type='button'
                        onClick={() =>
                          open({
                            tab: 'announcements',
                            step: 'announcement',
                            id: announcement.id,
                          })
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
                  {listed.length < own.length ? (
                    <button
                      type='button'
                      onClick={() => setAllEnded(true)}
                      className='h-12 w-full text-sm font-semibold tracking-tight text-theme-muted transition-colors hover:bg-theme-sunk hover:text-theme-ink'
                    >
                      {t.admin.announcements.showAllEnded(own.length)}
                    </button>
                  ) : null}
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
          onClick={() => open({tab: 'announcements', step: 'new'})}
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
