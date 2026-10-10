import {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {
  DURATIONS,
  durationOf,
  endsOnAfter,
  startOf,
} from '@/admin/announcement';
import {useAdminAccount} from '@/admin/account';
import {
  fieldLabel,
  isWritten,
  trimmedText,
  type Draft,
} from '@/admin/localized';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import type {LocalizedText} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {formatLongDate} from '@/lib/dates';
import theme from '@/theme.json';

export type AnnouncementFields = {
  title: LocalizedText;
  body: LocalizedText;
  endsOn: string | null;
};

type AnnouncementFormProps = {
  initial: AnnouncementFields & {publishedOn: string};
  today: string;
  submitLabel: string;
  onSubmit: (fields: AnnouncementFields) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

export function AnnouncementForm({
  initial,
  today,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: AnnouncementFormProps) {
  const t = useMessages();
  const {locales} = useAdminAccount();
  const [title, setTitle] = useState<Draft>(initial.title);
  const [body, setBody] = useState<Draft>(initial.body);
  const [endsOn, setEndsOn] = useState(initial.endsOn);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A new duration counts from today, also when an older announcement is
  // given more days.
  const start = startOf(initial.publishedOn, today);
  const duration = durationOf(start, endsOn);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: trimmedText(title, locales),
        body: trimmedText(body, locales),
        endsOn,
      });
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-3'>
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          label={fieldLabel(
            t.admin.announcementForm.title,
            language,
            locales,
            t,
          )}
          value={title[language] ?? ''}
          onChangeText={(text) => setTitle({...title, [language]: text})}
          maxLength={100}
          autoCapitalize='sentences'
        />
      ))}
      {locales.map((language) => {
        const label = fieldLabel(
          t.admin.announcementForm.body,
          language,
          locales,
          t,
        );

        return (
          <View key={language} className='gap-1.5'>
            <Text className='text-[13px] font-medium text-theme-muted'>
              {label}
            </Text>
            <TextInput
              value={body[language] ?? ''}
              onChangeText={(text) => setBody({...body, [language]: text})}
              multiline
              maxLength={2000}
              textAlignVertical='top'
              accessibilityLabel={label}
              className='min-h-[132px] rounded-sm border border-theme-edge bg-theme-surface px-4 py-3 text-base text-theme-ink'
              style={{fontFamily: 'Merriweather_400Regular', color: theme.ink}}
            />
          </View>
        );
      })}
      <View className='gap-2'>
        <Text className='text-[13px] font-medium text-theme-muted'>
          {t.admin.announcementForm.shownFor}
        </Text>
        <View className='flex-row flex-wrap gap-2'>
          {DURATIONS.map(({label, days}) => {
            const selected = duration === days;

            return (
              <Pressable
                key={String(days)}
                accessibilityState={{selected}}
                onPress={() =>
                  setEndsOn(days === null ? null : endsOnAfter(start, days))
                }
                className={`h-10 justify-center rounded-full border px-4 ${
                  selected
                    ? 'border-theme-ink bg-theme-ink'
                    : 'border-theme-edge bg-theme-surface active:bg-theme-sunk'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? 'text-theme-surface' : 'text-theme-ink'
                  }`}
                >
                  {label(t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {t.admin.announcementForm.shown(
            formatLongDate(initial.publishedOn, t),
            endsOn ? formatLongDate(endsOn, t) : null,
          )}
        </Text>
      </View>
      {error ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {error}
        </Text>
      ) : null}
      <View className='mt-2 flex-row flex-wrap gap-2.5'>
        <Pressable
          onPress={() => void submit()}
          disabled={
            submitting ||
            !isWritten(title, locales) ||
            !isWritten(body, locales)
          }
          className={PRIMARY_BUTTON}
        >
          <Text className={PRIMARY_LABEL}>{submitLabel}</Text>
        </Pressable>
        <Pressable onPress={onCancel} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>{t.common.cancel}</Text>
        </Pressable>
        {onDelete ? (
          <Pressable onPress={onDelete} className={SECONDARY_BUTTON}>
            <Text className={SECONDARY_LABEL}>{t.admin.remove}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
