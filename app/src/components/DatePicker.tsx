import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  getWeekdayLabel,
  groupDaysByMonth,
  toDateKey,
} from '@/data/bookableDates';

type DatePickerProps = {
  days: Date[];
  selectedDate: Date;
  onSelect: (date: Date) => void;
};

const todayKey = toDateKey(new Date());
const DAYS_VISIBLE = 7;
const HORIZONTAL_PADDING = 20;
const DAY_GAP = 4;

export function DatePicker({days, selectedDate, onSelect}: DatePickerProps) {
  const {width} = useWindowDimensions();
  const selectedKey = toDateKey(selectedDate);
  const months = groupDaysByMonth(days);
  const dayWidth =
    (width - HORIZONTAL_PADDING * 2 - DAY_GAP * (DAYS_VISIBLE - 1)) /
    DAYS_VISIBLE;
  const circleSize = Math.round(dayWidth * 0.72);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className='w-full grow-0'
      contentContainerClassName='items-start px-2 py-3'
    >
      {months.map((month, monthIndex) => (
        <View
          key={month.key}
          className={
            monthIndex > 0 ? 'border-l border-theme-line pl-3' : 'pr-3'
          }
        >
          <Text className='mb-2 px-3 text-lg font-semibold capitalize text-theme-ink'>
            {month.label}
          </Text>
          <View className='flex-row' style={{gap: DAY_GAP}}>
            {month.days.map((day) => {
              const key = toDateKey(day);
              const selected = key === selectedKey;
              const isToday = key === todayKey;

              return (
                <Pressable
                  key={key}
                  onPress={() => onSelect(day)}
                  style={{width: dayWidth}}
                  className='items-center active:opacity-70'
                >
                  <View className='h-7 justify-end'>
                    <Text
                      className={
                        selected
                          ? 'text-lg font-semibold text-theme-accent'
                          : 'text-sm text-theme-muted'
                      }
                    >
                      {getWeekdayLabel(day)}
                    </Text>
                  </View>
                  <View
                    style={{width: circleSize, height: circleSize}}
                    className={`mt-1 items-center justify-center rounded-full ${
                      selected ? 'bg-theme-ink' : ''
                    }`}
                  >
                    <Text
                      className={`text-lg ${
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
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
