import {DateTimePicker} from '@expo/ui/community/datetime-picker';
import {useAdminAccount} from '@brfhub/core/admin/account';
import {
  asksReason,
  changeDays,
  type ChangeKind,
} from '@brfhub/core/admin/change';
import {fieldLabel, type Draft} from '@brfhub/core/admin/localized';
import type {Locale} from '@brfhub/core/i18n/catalog';
import {
  formatDayHeading,
  formatLongDate,
  fromIsoDate,
  toIsoDate,
} from '@brfhub/core/lib/dates';
import {useState} from 'react';
import {Modal, Platform, Pressable, Text, View} from 'react-native';

import {Icon} from '@/components/Icon';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {theme} from '@/theme';

type ChangeDayProps = {
  kind: ChangeKind;
  label: string;
  today: string;
  freeFrom: string;
  day: string;
  onDay: (day: string) => void;
  reason: Draft;
  onReason: (reason: Draft) => void;
  onReasonBlur: (locale: Locale) => void;
  reasonProblem: (locale: Locale) => string | null;
};

// The day a change of times or a closing starts, and what it does to the
// bookings already made. A day before the first free one can cancel some,
// and new times then ask why, for the apartments told; a closing always
// does, since the closed resource shows it to everyone. Written in each of
// the organization's languages. The day opens the platform's own calendar
// in a dialog: ours around it on iOS, the system's on Android.
export function ChangeDay({
  kind,
  label,
  today,
  freeFrom,
  day,
  onDay,
  reason,
  onReason,
  onReasonBlur,
  reasonProblem,
}: ChangeDayProps) {
  const t = useMessages();
  const {locales} = useAdminAccount();
  const [open, setOpen] = useState(false);
  const {first, free} = changeDays(kind, today, freeFrom);
  const mayCancel = day < free;
  const closing = kind === 'closing';
  const asked = asksReason(kind, day, free);

  const choose = (date: Date) => {
    setOpen(false);
    onDay(toIsoDate(date));
  };

  return (
    <View className='gap-3'>
      <View>
        <Pressable
          onPress={() => setOpen((shown) => !shown)}
          accessibilityRole='button'
          accessibilityLabel={`${label}, ${formatLongDate(day, t)}`}
          accessibilityState={{expanded: open}}
          className={`h-[52px] flex-row items-center rounded-sm border bg-theme-surface pr-3.5 pl-3.5 active:opacity-70 ${
            open ? 'border-theme-ink' : 'border-theme-edge'
          }`}
        >
          <View className='flex-1 justify-end self-stretch pb-[5px]'>
            <Text
              numberOfLines={1}
              className='absolute top-[7px] text-[13px] font-medium text-theme-muted'
            >
              {label}
            </Text>
            <Text
              numberOfLines={1}
              className='font-sans text-base leading-6 text-theme-ink'
            >
              {formatDayHeading(day, t)}
            </Text>
          </View>
          <Icon name='calendar-outline' size={18} color={theme.muted} />
        </Pressable>
        {open ? (
          Platform.OS === 'ios' ? (
            <Modal
              visible
              transparent
              animationType='fade'
              statusBarTranslucent
              onRequestClose={() => setOpen(false)}
            >
              <Pressable
                className='flex-1 items-center justify-center bg-theme-scrim px-5'
                onPress={() => setOpen(false)}
                accessible={false}
              >
                <Pressable
                  className='w-full max-w-[360px] rounded-card border border-theme-line bg-theme-surface p-3'
                  accessibilityViewIsModal
                >
                  <DateTimePicker
                    value={fromIsoDate(day)}
                    mode='date'
                    display='inline'
                    minimumDate={fromIsoDate(first)}
                    onValueChange={(_event, date) => choose(date)}
                    accentColor={theme.ink}
                    locale={t.dates.locale.replace('-', '_')}
                    themeVariant='light'
                  />
                  <Pressable
                    accessibilityRole='button'
                    onPress={() => setOpen(false)}
                    className='mt-2 h-11 items-center justify-center rounded-full border border-theme-edge bg-theme-surface active:opacity-70'
                  >
                    <Text className='text-sm font-semibold tracking-tight text-theme-ink'>
                      {t.common.cancel}
                    </Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>
          ) : (
            <DateTimePicker
              value={fromIsoDate(day)}
              mode='date'
              presentation='dialog'
              minimumDate={fromIsoDate(first)}
              onValueChange={(_event, date) => choose(date)}
              onDismiss={() => setOpen(false)}
              accentColor={theme.ink}
            />
          )
        ) : null}
        <Text className='mt-1.5 font-sans text-[13px] leading-5 text-theme-muted'>
          {mayCancel
            ? t.admin.change.mayCancel(formatLongDate(free, t))
            : t.admin.change.noCancels}
        </Text>
      </View>
      {asked ? (
        <View className='gap-3'>
          {locales.map((language) => (
            <FloatingLabelInput
              key={language}
              label={fieldLabel(
                closing ? t.admin.change.note : t.admin.change.reason,
                language,
                locales,
                t,
              )}
              value={reason[language] ?? ''}
              onChangeText={(text) => onReason({...reason, [language]: text})}
              onBlur={() => onReasonBlur(language)}
              problem={reasonProblem(language)}
            />
          ))}
          <Text className='-mt-1.5 font-sans text-[13px] leading-5 text-theme-muted'>
            {closing ? t.admin.change.noteHint : t.admin.change.reasonHint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
