import {useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {api, unwrap, type Announcement} from '@/api/client';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';
import {formatDayMonth} from '@/lib/dates';
import {readDismissed, saveDismissed} from '@/lib/dismissed';

function fetchAnnouncements() {
  return unwrap(api.GET('/announcements'));
}

// Announcements are a courtesy on top of booking, so a failed load shows
// nothing rather than an error in the way.
function useAnnouncements(): Announcement[] {
  const {data} = useFocusLoad(fetchAnnouncements);
  return data ?? [];
}

// An edited announcement counts as new, so it shows again on a device
// that hid it.
function keyOf(announcement: Announcement): string {
  return `${announcement.id}:${announcement.updatedAt}`;
}

// How far each announcement waiting behind the shown one peeks out.
const PEEK = {down: 6, inset: 10};

// The newest announcement the apartment has not hidden on this device,
// with up to two edges below it when more are waiting.
export function AnnouncementBanner({className}: {className?: string}) {
  const announcements = useAnnouncements();
  const t = useMessages();
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    void readDismissed().then(setDismissed);
  }, []);

  const waiting =
    dismissed === null
      ? []
      : announcements.filter((item) => !dismissed.includes(keyOf(item)));
  const shown = waiting[0];
  const behind = Math.min(waiting.length - 1, 2);

  if (!shown) {
    return null;
  }

  // Only what is still current is kept, so the list stays short.
  const hide = () => {
    const current = new Set(announcements.map(keyOf));
    const next = [
      keyOf(shown),
      ...(dismissed ?? []).filter((key) => current.has(key)),
    ];
    setDismissed(next);
    void saveDismissed(next);
  };

  return (
    <View className={className}>
      <View style={{paddingBottom: behind * PEEK.down}}>
        {[2, 1]
          .filter((depth) => depth <= behind)
          .map((depth) => (
            <View
              key={depth}
              className='absolute rounded-2xl border border-theme-line bg-theme-mist'
              style={{
                top: depth * PEEK.down,
                bottom: (behind - depth) * PEEK.down,
                left: depth * PEEK.inset,
                right: depth * PEEK.inset,
                opacity: 1 - depth * 0.3,
              }}
            />
          ))}
        <View
          accessibilityLabel={t.announcements.heading}
          className='flex-row items-start gap-3 rounded-2xl border border-theme-line bg-theme-mist px-[18px] py-3.5'
        >
          <View className='min-w-0 flex-1 gap-1'>
            <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
              {shown.title}
            </Text>
            <Text
              numberOfLines={4}
              className='font-sans text-[13px] leading-5 text-theme-ink'
            >
              {shown.body}
            </Text>
          </View>
          <Pressable
            onPress={hide}
            hitSlop={8}
            className='-mr-1 px-1 active:opacity-60'
          >
            <Text className='text-[13px] font-semibold text-theme-muted'>
              {t.announcements.hide}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Every current announcement, hidden ones too, for when the apartment
// wants to read one again.
export function AnnouncementList() {
  const announcements = useAnnouncements();
  const t = useMessages();

  if (announcements.length === 0) {
    return null;
  }

  return (
    <View className='mb-[26px]'>
      <Text className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
        {t.announcements.heading}
      </Text>
      <View className='gap-2.5'>
        {announcements.map((announcement) => (
          <View
            key={announcement.id}
            className='gap-1 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'
          >
            <Text className='font-sans text-xs text-theme-muted'>
              {formatDayMonth(announcement.publishedOn, t)}
            </Text>
            <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
              {announcement.title}
            </Text>
            <Text className='font-sans text-[13px] leading-5 text-theme-ink'>
              {announcement.body}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
