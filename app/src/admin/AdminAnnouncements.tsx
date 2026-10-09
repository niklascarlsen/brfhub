import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Alert, Pressable, Text, View} from 'react-native';

import {useAdminAccount} from '@/admin/account';
import {AdminPage} from '@/admin/AdminPage';
import {AnnouncementForm} from '@/admin/AnnouncementForm';
import {PRIMARY_BUTTON, PRIMARY_LABEL, SECTION_LABEL} from '@/admin/styles';
import {api, unwrap, type AdminAnnouncement} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {Notice} from '@/components/Notice';
import {Skeleton, SkeletonBar} from '@/components/Skeleton';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useSlowLoad} from '@/hooks/useSlowLoad';
import {formatDayMonth, toIsoDate} from '@/lib/dates';
import theme from '@/theme.json';

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
            Alert.alert(
              'Ta bort anslaget',
              `”${edited.title}” tas bort och visas inte längre.`,
              [
                {text: 'Avbryt', style: 'cancel'},
                {
                  text: 'Ta bort',
                  style: 'destructive',
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
                        Alert.alert(
                          'Kunde inte ta bort anslaget',
                          errorMessage(codeOf(caught)),
                        ),
                      );
                  },
                },
              ],
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
        <Text className='font-sans text-sm leading-5 text-theme-muted'>
          Inga anslag än. Ett anslag visas överst för alla lägenheter, till
          exempel om en städdag eller ett stopp i tvättstugan.
        </Text>
      ) : (
        <View className='gap-[26px]'>
          {GROUPS.map(({status, label}) => {
            const own = data.filter((item) => item.status === status);

            if (own.length === 0) {
              return null;
            }

            return (
              <View key={status}>
                <Text className={SECTION_LABEL}>{label}</Text>
                <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                  {own.map((announcement, index) => (
                    <Pressable
                      key={announcement.id}
                      onPress={() =>
                        setScreen({kind: 'edit', id: announcement.id})
                      }
                      className={`flex-row items-center gap-3 px-[18px] py-3.5 active:bg-theme-sunk ${
                        index === own.length - 1
                          ? ''
                          : 'border-b border-theme-line'
                      }`}
                    >
                      <View className='min-w-0 flex-1 gap-0.5'>
                        <Text
                          numberOfLines={1}
                          className='text-[15px] font-semibold tracking-tight text-theme-ink'
                        >
                          {announcement.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          className='font-sans text-[13px] text-theme-muted'
                        >
                          {periodOf(announcement)}
                        </Text>
                      </View>
                      <Ionicons
                        name='chevron-forward'
                        size={16}
                        color={theme.faint}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      );
  } else if (error) {
    body = (
      <Notice message={error} actionLabel='Försök igen' onAction={reload} />
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
      title='Anslag'
      subtitle={organizationName}
      action={
        <Pressable
          onPress={() => setScreen({kind: 'add'})}
          className={PRIMARY_BUTTON}
        >
          <Ionicons name='add' size={18} color={theme.surface} />
          <Text className={PRIMARY_LABEL}>Nytt anslag</Text>
        </Pressable>
      }
    >
      {body}
    </AdminPage>
  );
}
