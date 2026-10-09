import {useEffect, useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {api, unwrap, type Announcement} from '@/api/client';
import {useFocusLoad} from '@/hooks/useFocusLoad';
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

// The newest announcement the apartment has not hidden on this device.
export function AnnouncementBanner({className}: {className?: string}) {
  const announcements = useAnnouncements();
  const [dismissed, setDismissed] = useState<string[] | null>(null);

  useEffect(() => {
    void readDismissed().then(setDismissed);
  }, []);

  const shown =
    dismissed === null
      ? undefined
      : announcements.find((item) => !dismissed.includes(keyOf(item)));

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
    <View
      accessibilityLabel='Anslag'
      className={`flex-row items-start gap-3 rounded-2xl border border-theme-line bg-theme-mist px-[18px] py-3.5 ${className ?? ''}`}
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
        <Text className='text-[13px] font-semibold text-theme-muted'>Dölj</Text>
      </Pressable>
    </View>
  );
}

// Every current announcement, hidden ones too, for when the apartment
// wants to read one again.
export function AnnouncementList() {
  const announcements = useAnnouncements();

  if (announcements.length === 0) {
    return null;
  }

  return (
    <View className='mb-[26px]'>
      <Text className='mb-2.5 ml-0.5 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
        Anslag
      </Text>
      <View className='gap-2.5'>
        {announcements.map((announcement) => (
          <View
            key={announcement.id}
            className='gap-1 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-4'
          >
            <Text className='font-sans text-xs text-theme-muted'>
              {formatDayMonth(announcement.publishedOn)}
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
