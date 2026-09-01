import {Fragment} from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {getWeekdayLabel, groupDaysByMonth, toIsoDate} from '@/lib/dates';

type DatePickerProps = {
  days: Date[];
  selectedDate: Date;
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
  selectedDate,
  todayIso,
  onSelect,
}: DatePickerProps) {
  const {width} = useWindowDimensions();
  const selectedIso = toIsoDate(selectedDate);
  const months = groupDaysByMonth(days);
  const dayWidth =
    (width - HORIZONTAL_PADDING * 2 - DAY_GAP * (DAYS_VISIBLE - 1)) /
    DAYS_VISIBLE;
  const circleSize = Math.round(dayWidth * CIRCLE_RATIO);

  return (
    <ScrollView
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
                  {getWeekdayLabel(day)}
                </Text>
                <View
                  style={{width: circleSize, height: circleSize}}
                  className={`mt-1.5 items-center justify-center rounded-full ${
                    selected ? 'bg-theme-ink' : ''
                  }`}
                >
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
