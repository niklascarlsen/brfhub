import {checkSchedule, failureMessage} from '@booking/core/admin/drafts';
import {useProblems} from '@booking/core/admin/useProblems';
import type {SlotInput} from '@booking/core/api/types';
import {formatLongDate} from '@booking/core/lib/dates';
import {useState, type SubmitEvent} from 'react';

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

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
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
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-4'
    >
      <p className='text-sm leading-5 text-theme-ink'>
        {t.admin.scheduleForm.note(formatLongDate(validFrom, t))}
      </p>
      <div>
        <SlotsEditor slots={slots} onChange={setSlots} />
        {slotsProblem ? <FieldProblem message={slotsProblem} /> : null}
      </div>
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={t.admin.scheduleForm.save}
        dirty={checked.changed}
        submitting={submitting}
        onCancel={onCancel}
      />
    </form>
  );
}
