import {useState, type SubmitEvent} from 'react';

import {slotsProblem} from '@/admin/schedule';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
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

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = slotsProblem(slots);

    if (problem) {
      setError(problem);
      return;
    }

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
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-4'
    >
      <p className='text-sm leading-5 text-theme-ink'>
        De nya tiderna gäller från {formatLongDate(validFrom)}. Tiden fram till
        dess går redan att boka, så de bokningarna står kvar.
      </p>
      <SlotsEditor slots={slots} onChange={setSlots} />
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <div className='mt-2 flex flex-wrap gap-2.5'>
        <button type='submit' disabled={submitting} className={PRIMARY_BUTTON}>
          Spara tiderna
        </button>
        <button type='button' onClick={onCancel} className={SECONDARY_BUTTON}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
