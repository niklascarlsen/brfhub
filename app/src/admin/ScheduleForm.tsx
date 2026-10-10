import {useState} from 'react';
import {Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {slotsProblem} from '@/admin/schedule';
import {SlotsEditor} from '@/admin/SlotsEditor';
import type {SlotInput} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {useMessages} from '@/i18n/LocaleProvider';
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
  const t = useMessages();
  const [slots, setSlots] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const problem = slotsProblem(slots, t);

    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(slots);
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-4'>
      <Text className='font-sans text-sm leading-5 text-theme-ink'>
        {t.admin.scheduleForm.note(formatLongDate(validFrom, t))}
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
      <FormActions
        submitLabel={t.admin.scheduleForm.save}
        dirty={JSON.stringify(slots) !== JSON.stringify(initial)}
        valid={slots.length > 0}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}
