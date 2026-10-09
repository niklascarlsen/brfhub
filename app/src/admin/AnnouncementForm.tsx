import {useState} from 'react';
import {Pressable, Text, TextInput, View} from 'react-native';

import {
  DURATIONS,
  durationOf,
  endsOnAfter,
  startOf,
} from '@/admin/announcement';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {formatLongDate} from '@/lib/dates';
import theme from '@/theme.json';

export type AnnouncementFields = {
  title: string;
  body: string;
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
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
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
        title: title.trim(),
        body: body.trim(),
        endsOn,
      });
    } catch (caught) {
      setError(errorMessage(codeOf(caught)));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-3'>
      <FloatingLabelInput
        label='Rubrik'
        value={title}
        onChangeText={setTitle}
        maxLength={100}
        autoCapitalize='sentences'
      />
      <View className='gap-1.5'>
        <Text className='text-[13px] font-medium text-theme-muted'>Text</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={2000}
          textAlignVertical='top'
          accessibilityLabel='Text'
          className='min-h-[132px] rounded-sm border border-theme-edge bg-theme-surface px-4 py-3 text-base text-theme-ink'
          style={{fontFamily: 'Merriweather_400Regular', color: theme.ink}}
        />
      </View>
      <View className='gap-2'>
        <Text className='text-[13px] font-medium text-theme-muted'>Visas</Text>
        <View className='flex-row flex-wrap gap-2'>
          {DURATIONS.map(({label, days}) => {
            const selected = duration === days;

            return (
              <Pressable
                key={label}
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
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          Från {formatLongDate(initial.publishedOn)}
          {endsOn ? ` till och med ${formatLongDate(endsOn)}` : ''}.
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
            submitting || title.trim().length === 0 || body.trim().length === 0
          }
          className={PRIMARY_BUTTON}
        >
          <Text className={PRIMARY_LABEL}>{submitLabel}</Text>
        </Pressable>
        <Pressable onPress={onCancel} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>Avbryt</Text>
        </Pressable>
        {onDelete ? (
          <Pressable onPress={onDelete} className={SECONDARY_BUTTON}>
            <Text className={SECONDARY_LABEL}>Ta bort</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
