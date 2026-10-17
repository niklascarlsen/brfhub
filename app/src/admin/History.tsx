import {
  describeEvent,
  EVENT_AREAS,
  eventActor,
  formatEventClock,
  groupEventsByDay,
  type EventDay,
} from '@booking/core/admin/events';
import {useEventHistory} from '@booking/core/admin/useEventHistory';
import {errorMessage} from '@booking/core/api/errors';
import type {EventArea} from '@booking/core/api/types';
import {useEffect, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {scheduleOnUI} from 'react-native-worklets';

import {usePageScroll} from '@/admin/AdminPage';
import {
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL_TEXT,
} from '@/admin/styles';
import {Notice, NoticeBar} from '@/components/Notice';
import {useFocusLoad} from '@/hooks/useFocusLoad';
import {adminLoad} from '@/hooks/useAdminActions';
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

// A day's events under its heading, which sticks to the top of the page
// while the day scrolls under it, so the day read is always in sight.
function Day({day, moved}: {day: EventDay; moved: number}) {
  const t = useMessages();
  const page = usePageScroll();
  const section = useAnimatedRef<Animated.View>();
  // Where the day starts in what scrolls and how tall it is, and where its
  // heading sits in it, which reaches a little above the day.
  const start = useSharedValue<number | null>(null);
  const height = useSharedValue(0);
  const heading = useSharedValue({y: 0, height: 0});

  // Measured from the top of what scrolls, so the scroll itself does not
  // count. Again whenever the day or anything above it moves.
  const place = () => {
    if (!page) {
      return;
    }

    const {top} = page;
    scheduleOnUI(() => {
      'worklet';
      const own = measure(section);
      const from = measure(top);
      if (own && from) {
        start.value = own.pageY - from.pageY;
        height.value = own.height;
      }
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(place, [moved]);

  const stuck = useAnimatedStyle(() => {
    if (!page || start.value === null) {
      return {transform: [{translateY: 0}]};
    }

    // From where the heading meets the top of the page, until its foot
    // meets the day's.
    const {y, height: own} = heading.value;
    const past = page.scrollY.value - start.value - y;
    const end = height.value - y - own;
    return {
      transform: [{translateY: Math.min(Math.max(past, 0), Math.max(end, 0))}],
    };
  });

  return (
    <Animated.View ref={section} collapsable={false} onLayout={place}>
      <Animated.View
        onLayout={(event) => {
          const {y, height: own} = event.nativeEvent.layout;
          heading.value = {y, height: own};
        }}
        style={stuck}
        // Over the rows passing under it, across the screen.
        className='z-10 -mx-5 -mt-2 bg-theme-bg px-5 pb-2.5 pt-2'
      >
        <Text accessibilityRole='header' className={SECTION_LABEL_TEXT}>
          {day.heading}
        </Text>
      </Animated.View>
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
    </Animated.View>
  );
}

// What the admins have done in the last year, a day at a time, newest
// first, a page at a time, narrowed to one part of the admin if asked.
export function History() {
  const t = useMessages();
  const [area, setArea] = useState<EventArea | null>(null);
  const key = area ?? '';
  const newest = useFocusLoad(() => adminLoad.events(area), key);
  // Another area's list stays until this one's comes, so the chips and the
  // page stay where they are.
  const history = useEventHistory(newest.data, key, (after) =>
    adminLoad.events(area, after),
  );
  // Counts the moves of the list, which the days measure themselves again
  // after.
  const [moved, setMoved] = useState(0);

  const {events} = history;
  if (events === null) {
    return newest.error ? (
      <Notice
        message={newest.error}
        actionLabel={t.common.retry}
        onAction={newest.reload}
      />
    ) : null;
  }

  if (events.length === 0 && history.shownKey === '') {
    return (
      <Text className='font-sans text-sm text-theme-muted'>
        {t.admin.events.none}
      </Text>
    );
  }

  const days = groupEventsByDay(events, t);

  return (
    <View className='gap-5' onLayout={() => setMoved((count) => count + 1)}>
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
      {newest.error ? (
        // The bar's own margin is the list's gap here.
        <View className='-mb-4'>
          <NoticeBar
            message={newest.error}
            actionLabel={t.common.retry}
            onAction={newest.reload}
          />
        </View>
      ) : null}
      {/* Another area's list is not shown as this one's when it failed. */}
      {history.stale && newest.error ? null : days.length === 0 ? (
        <Text className='font-sans text-sm text-theme-muted'>
          {t.admin.events.noneIn}
        </Text>
      ) : (
        days.map((day) => <Day key={day.day} day={day} moved={moved} />)
      )}
      {history.olderError ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {errorMessage(history.olderError, t)}
        </Text>
      ) : null}
      {history.hasOlder ? (
        <Pressable
          onPress={history.showOlder}
          disabled={history.loadingOlder}
          className={`${SECONDARY_BUTTON} self-start`}
        >
          <Text className={SECONDARY_LABEL}>{t.admin.events.older}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
