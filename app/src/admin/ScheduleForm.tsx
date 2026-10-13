import {checkSchedule, failureMessage} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import type {SlotInput} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {useState} from 'react';
import {Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {FieldProblem} from '@/components/FieldProblem';
import {useMessages} from '@/i18n/LocaleProvider';

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
  const checked = checkSchedule(slots, initial, t);
  const {problem, ready} = useProblems(checked);
  const slotsProblem = problem('slots');

  async function submit() {
    if (!ready()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(checked.value);
    } catch (caught) {
      setError(failureMessage(caught, t));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-4'>
      <Text className='font-sans text-sm leading-5 text-theme-ink'>
        {t.admin.scheduleForm.note(formatLongDate(validFrom, t))}
      </Text>
      <View>
        <SlotsEditor slots={slots} onChange={setSlots} />
        {slotsProblem ? <FieldProblem message={slotsProblem} /> : null}
      </View>
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
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}
