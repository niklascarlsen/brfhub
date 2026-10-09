import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {SlotsEditor} from '@/admin/SlotsEditor';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import type {SlotInput} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {formatLongDate} from '@/lib/dates';

type ScheduleFormProps = {
  initial: SlotInput[];
  validFrom: string;
  onSubmit: (slots: SlotInput[]) => Promise<void>;
  onCancel: () => void;
};

export function ScheduleForm({
  initial,
  validFrom,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [slots, setSlots] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(slots);
    } catch (caught) {
      setError(errorMessage(codeOf(caught)));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-4'>
      <Text className='font-sans text-sm leading-5 text-theme-ink'>
        De nya tiderna gäller från {formatLongDate(validFrom)}. Tiden fram till
        dess går redan att boka, så de bokningarna står kvar.
      </Text>
      <SlotsEditor slots={slots} onChange={setSlots} />
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
          disabled={submitting}
          className={PRIMARY_BUTTON}
        >
          <Text className={PRIMARY_LABEL}>Spara tiderna</Text>
        </Pressable>
        <Pressable onPress={onCancel} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}
