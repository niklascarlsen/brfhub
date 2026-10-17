import {
  describeEvent,
  EVENT_AREAS,
  eventActor,
  eventArea,
  formatEventClock,
  groupEventsByDay,
  type EventArea,
} from '@booking/core/admin/events';
import type {AdminEvent} from '@booking/core/api/types';
import {useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';

import {SECTION_LABEL} from '@/admin/styles';
import {useMessages} from '@/i18n/LocaleProvider';

function AreaChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityState={{selected}}
      onPress={onPress}
      className={`h-9 justify-center rounded-full border px-3.5 ${
        selected
          ? 'border-theme-ink bg-theme-ink'
          : 'border-theme-edge bg-theme-surface active:bg-theme-sunk'
      }`}
    >
      <Text
        className={`text-[13px] font-semibold ${
          selected ? 'text-theme-surface' : 'text-theme-ink'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// What the admins have done in the last year, a day at a time, newest
// first, narrowed to one part of the admin if asked.
export function History({events}: {events: AdminEvent[]}) {
  const t = useMessages();
  const [area, setArea] = useState<EventArea | null>(null);

  if (events.length === 0) {
    return (
      <Text className='font-sans text-sm text-theme-muted'>
        {t.admin.events.none}
      </Text>
    );
  }

  const shown =
    area === null
      ? events
      : events.filter((event) => eventArea(event) === area);
  const days = groupEventsByDay(shown, t);

  return (
    <View className='gap-5'>
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        {t.admin.events.note}
      </Text>
      {/* Scrolls sideways out to the screen's edge. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t.admin.events.filter}
        className='-mx-5'
        contentContainerClassName='gap-2 px-5'
      >
        <AreaChip
          label={t.admin.events.all}
          selected={area === null}
          onPress={() => setArea(null)}
        />
        {EVENT_AREAS.map((item) => (
          <AreaChip
            key={item}
            label={t.admin.events.areas[item]}
            selected={area === item}
            onPress={() => setArea(item)}
          />
        ))}
      </ScrollView>
      {days.length === 0 ? (
        <Text className='font-sans text-sm text-theme-muted'>
          {t.admin.events.noneIn}
        </Text>
      ) : (
        days.map((day) => (
          <View key={day.day}>
            <Text accessibilityRole='header' className={SECTION_LABEL}>
              {day.heading}
            </Text>
            <View className='overflow-hidden rounded-card border border-theme-line bg-theme-surface'>
              {day.events.map((event, index) => (
                <View
                  key={event.id}
                  className={`flex-row gap-3 px-[18px] py-3 ${
                    index === day.events.length - 1
                      ? ''
                      : 'border-b border-theme-line'
                  }`}
                >
                  <Text
                    className='w-12 font-sans text-[13px] text-theme-muted'
                    style={{fontVariant: ['tabular-nums']}}
                  >
                    {formatEventClock(event.at, t)}
                  </Text>
                  <View className='min-w-0 flex-1 gap-0.5'>
                    <Text className='font-sans text-sm text-theme-ink'>
                      {describeEvent(event, t)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      className='font-sans text-[13px] text-theme-muted'
                    >
                      {eventActor(event)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}
