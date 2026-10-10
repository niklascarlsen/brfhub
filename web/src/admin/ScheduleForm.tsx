import {useState, type SubmitEvent} from 'react';

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

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-4'
    >
      <p className='text-sm leading-5 text-theme-ink'>
        {t.admin.scheduleForm.note(formatLongDate(validFrom, t))}
      </p>
      <SlotsEditor slots={slots} onChange={setSlots} />
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={t.admin.scheduleForm.save}
        dirty={JSON.stringify(slots) !== JSON.stringify(initial)}
        valid={slots.length > 0}
        submitting={submitting}
        onCancel={onCancel}
      />
    </form>
  );
}
