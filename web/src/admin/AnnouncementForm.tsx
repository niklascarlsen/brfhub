import {useState, type SubmitEvent} from 'react';

import {DURATIONS, durationOf, endsOnAfter} from '@/admin/announcement';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {formatLongDate} from '@/lib/dates';

export type AnnouncementFields = {
  title: string;
  body: string;
  publishedOn: string;
  endsOn: string | null;
};

type AnnouncementFormProps = {
  initial: AnnouncementFields;
  submitLabel: string;
  onSubmit: (fields: AnnouncementFields) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

export function AnnouncementForm({
  initial,
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
  const duration = durationOf(initial.publishedOn, endsOn);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        publishedOn: initial.publishedOn,
        endsOn,
      });
    } catch (caught) {
      setError(errorMessage(codeOf(caught)));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      <FloatingLabelInput
        label='Rubrik'
        required
        maxLength={100}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className='flex flex-col gap-1.5'>
        <span className='text-[13px] font-medium text-theme-muted'>Text</span>
        <textarea
          required
          maxLength={2000}
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className='w-full rounded-xs border border-theme-edge bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink focus:border-theme-ink'
        />
      </label>
      <fieldset className='flex flex-col gap-2'>
        <legend className='mb-2 text-[13px] font-medium text-theme-muted'>
          Visas
        </legend>
        <div className='flex flex-wrap gap-2'>
          {DURATIONS.map(({label, days}) => {
            const selected = duration === days;

            return (
              <button
                key={label}
                type='button'
                aria-pressed={selected}
                onClick={() =>
                  setEndsOn(
                    days === null
                      ? null
                      : endsOnAfter(initial.publishedOn, days),
                  )
                }
                className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-theme-ink bg-theme-ink text-theme-surface'
                    : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <span className='text-[13px] leading-5 text-theme-muted'>
          Från {formatLongDate(initial.publishedOn)}
          {endsOn ? ` till och med ${formatLongDate(endsOn)}` : ''}.
        </span>
      </fieldset>
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <div className='mt-2 flex flex-wrap gap-2.5'>
        <button type='submit' disabled={submitting} className={PRIMARY_BUTTON}>
          {submitLabel}
        </button>
        <button type='button' onClick={onCancel} className={SECONDARY_BUTTON}>
          Avbryt
        </button>
        {onDelete ? (
          <button
            type='button'
            onClick={onDelete}
            className={`${SECONDARY_BUTTON} ml-auto`}
          >
            Ta bort
          </button>
        ) : null}
      </div>
    </form>
  );
}
