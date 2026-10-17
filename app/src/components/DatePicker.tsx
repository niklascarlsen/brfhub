import {
  getWeekdayLabel,
  groupDaysByMonth,
  toIsoDate,
} from '@brfhub/core/lib/dates';
import {Fragment} from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {useRevealSelected} from '@/hooks/useRevealSelected';
import {useMessages} from '@/i18n/LocaleProvider';

type DatePickerProps = {
  days: Date[];
  selectedIso: string;
  todayIso: string;
  onSelect: (date: Date) => void;
};

const DAYS_VISIBLE = 7;
const HORIZONTAL_PADDING = 20;
const DAY_GAP = 4;
const CIRCLE_RATIO = 0.82;

const tabularNums = {fontVariant: ['tabular-nums' as const]};

export function DatePicker({
  days,
  selectedIso,
  todayIso,
  onSelect,
}: DatePickerProps) {
  const t = useMessages();
  const {width} = useWindowDimensions();
  const dayWidth =
    (width - HORIZONTAL_PADDING * 2 - DAY_GAP * (DAYS_VISIBLE - 1)) /
    DAYS_VISIBLE;
  const circleSize = Math.round(dayWidth * CIRCLE_RATIO);
  const months = groupDaysByMonth(days, todayIso, t);
  const {scrollProps, itemLayout} = useRevealSelected(selectedIso);

  return (
    <ScrollView
      {...scrollProps}
      horizontal
      showsHorizontalScrollIndicator={false}
      className='w-full grow-0'
      contentContainerClassName='items-stretch px-5 py-2.5'
      contentContainerStyle={{gap: DAY_GAP}}
    >
      {months.map((month, monthIndex) => (
        <Fragment key={month.key}>
          {monthIndex > 0 ? (
            <View className='w-4 items-center'>
              <View className='h-6' />
              <View className='w-px flex-1 bg-theme-line' />
            </View>
          ) : null}
          {month.days.map((day, dayIndex) => {
            const isoDate = toIsoDate(day);
            const selected = isoDate === selectedIso;
            const isToday = isoDate === todayIso;

            return (
              <Pressable
                key={isoDate}
                onPress={() => onSelect(day)}
                onLayout={itemLayout(isoDate)}
                style={{width: dayWidth}}
                className='items-center active:opacity-60'
              >
                <View className='h-6 justify-end'>
                  {dayIndex === 0 ? (
                    <Text className='mb-1 text-[11px] font-bold uppercase tracking-[1px] text-theme-muted'>
                      {month.label}
                    </Text>
                  ) : null}
                </View>
                <Text className='text-xs font-medium text-theme-muted'>
                  {getWeekdayLabel(day, t)}
                </Text>
                <View
                  style={{width: circleSize, height: circleSize}}
                  className='mt-1.5 items-center justify-center'
                >
                  {selected ? (
                    <View
                      style={{borderRadius: circleSize / 2}}
                      className='absolute inset-0 bg-theme-ink'
                    />
                  ) : null}
                  <Text
                    style={tabularNums}
                    className={`text-base ${
                      selected
                        ? 'font-semibold text-theme-surface'
                        : isToday
                          ? 'font-semibold text-theme-accent'
                          : 'font-medium text-theme-ink'
                    }`}
                  >
                    {day.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Fragment>
      ))}
    </ScrollView>
  );
}
