import {ENDED_SHOWN} from '@booking/core/admin/announcement';
import {useAdminAccount, useRefreshAccount} from '@booking/core/admin/account';
import {missingLanguages} from '@booking/core/admin/localized';
import type {AdminAnnouncement} from '@booking/core/api/types';
import {useSlowLoad} from '@booking/core/hooks/useSlowLoad';
import {localize, type Messages} from '@booking/core/i18n/catalog';
import {formatDayMonth} from '@booking/core/lib/dates';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {AdminPage} from '@/admin/AdminPage';
import {AnnouncementForm} from '@/admin/AnnouncementForm';
import {Gone} from '@/admin/Gone';
import {useAdminLocation} from '@/admin/location';
import {PRIMARY_BUTTON, PRIMARY_LABEL, SECTION_LABEL} from '@/admin/styles';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {adminLoad, useAdminActions} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

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
        <Text className='font-sans text-sm leading-5 text-theme-muted'>
          {t.admin.announcements.none}
        </Text>
      ) : (
        <View className='gap-[26px]'>
          {GROUPS.map(({status, label}) => {
            const own = data.announcements.filter(
              (item) => item.status === status,
            );

            if (own.length === 0) {
              return null;
            }

            const listed =
              status === 'ended' && !allEnded ? own.slice(0, ENDED_SHOWN) : own;
            const more = listed.length < own.length;

            return (
              <View key={status}>
                <Text className={SECTION_LABEL}>{label(t)}</Text>
                <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {listed.map((announcement, index) => {
                    const missing =
                      missingLanguages(announcement.title, locales, t) ??
                      missingLanguages(announcement.body, locales, t);

                    return (
                      <Pressable
                        key={announcement.id}
                        onPress={() =>
                          open({
                            tab: 'announcements',
                            step: 'announcement',
                            id: announcement.id,
                          })
                        }
                        className={`flex-row items-center gap-3 px-[18px] py-3.5 active:bg-theme-sunk ${
                          index === listed.length - 1 && !more
                            ? ''
                            : 'border-b border-theme-line'
                        }`}
                      >
                        <View className='min-w-0 flex-1 gap-0.5'>
                          <Text
                            numberOfLines={1}
                            className='text-[15px] font-semibold tracking-tight text-theme-ink'
                          >
                            {localize(announcement.title, locale)}
                          </Text>
                          <Text
                            numberOfLines={1}
                            className='font-sans text-[13px] text-theme-muted'
                          >
                            {periodOf(announcement, t)}
                          </Text>
                          {missing ? (
                            <Text className='font-sans text-xs text-theme-accent'>
                              {t.admin.localized.untranslated(missing)}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons
                          name='chevron-forward'
                          size={16}
                          color={theme.faint}
                        />
                      </Pressable>
                    );
                  })}
                  {more ? (
                    <Pressable
                      onPress={() => setAllEnded(true)}
                      className='h-12 items-center justify-center active:bg-theme-sunk'
                    >
                      <Text className='text-[0.875rem] font-semibold tracking-tight text-theme-muted'>
                        {t.admin.announcements.showAllEnded(own.length)}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
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
            <SkeletonBar key={index} className='h-16 w-full rounded-2xl' />
          ))}
        </View>
      </Skeleton>
    );
  }

  return (
    <AdminPage
      title={t.tabs.announcements}
      subtitle={organizationName}
      action={
        <Pressable
          onPress={() => open({tab: 'announcements', step: 'new'})}
          className={PRIMARY_BUTTON}
        >
          <Ionicons name='add' size={18} color={theme.surface} />
          <Text className={PRIMARY_LABEL}>{t.admin.announcements.new}</Text>
        </Pressable>
      }
    >
      {body}
    </AdminPage>
  );
}
