import {describeEvent, formatEventTime} from '@booking/core/admin/events';
import {Text, View} from 'react-native';

import {Notice} from '@/components/Notice';
import {adminLoad} from '@/hooks/useAdminActions';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {useMessages} from '@/i18n/LocaleProvider';

// What the admins have done, newest first.
export function Events() {
  const t = useMessages();
  const {data: events, error, reload} = useFocusLoad(adminLoad.events);

  if (error && !events) {
    return (
      <Notice message={error} actionLabel={t.common.retry} onAction={reload} />
    );
  }

  if (!events) {
    return null;
  }

  if (events.length === 0) {
    return (
      <Text className='font-sans text-sm text-theme-muted'>
        {t.admin.events.none}
      </Text>
    );
  }

  return (
    <View className='gap-3'>
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        {t.admin.events.note}
      </Text>
      <View className='overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
        {events.map((event, index) => (
          <View
            key={event.id}
            className={`gap-0.5 px-[18px] py-3 ${
              index === events.length - 1 ? '' : 'border-b border-theme-line'
            }`}
          >
            <Text className='font-sans text-sm text-theme-ink'>
              {describeEvent(event, t)}
            </Text>
            <Text className='font-sans text-[13px] text-theme-muted'>
              {`${formatEventTime(event.at, t)} · ${event.actor}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
