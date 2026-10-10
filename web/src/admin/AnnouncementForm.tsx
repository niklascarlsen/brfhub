import {useState, type SubmitEvent} from 'react';

import {
  DURATIONS,
  durationOf,
  endsOnAfter,
  startOf,
} from '@/admin/announcement';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';
import {formatLongDate} from '@/lib/dates';

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
  const t = useMessages();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [endsOn, setEndsOn] = useState(initial.endsOn);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A new duration counts from today, also when an older announcement is
  // given more days.
  const start = startOf(initial.publishedOn, today);
  const duration = durationOf(start, endsOn);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        endsOn,
      });
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      <FloatingLabelInput
        label={t.admin.announcementForm.title}
        required
        maxLength={100}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className='flex flex-col gap-1.5'>
        <span className='text-[13px] font-medium text-theme-muted'>
          {t.admin.announcementForm.body}
        </span>
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
          {t.admin.announcementForm.shownFor}
        </legend>
        <div className='flex flex-wrap gap-2'>
          {DURATIONS.map(({label, days}) => {
            const selected = duration === days;

            return (
              <button
                key={String(days)}
                type='button'
                aria-pressed={selected}
                onClick={() =>
                  setEndsOn(days === null ? null : endsOnAfter(start, days))
                }
                className={`h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  selected
                    ? 'border-theme-ink bg-theme-ink text-theme-surface'
                    : 'border-theme-edge bg-theme-surface text-theme-ink hover:bg-theme-sunk'
                }`}
              >
                {label(t)}
              </button>
            );
          })}
        </div>
        <span className='text-[13px] leading-5 text-theme-muted'>
          {t.admin.announcementForm.shown(
            formatLongDate(initial.publishedOn, t),
            endsOn ? formatLongDate(endsOn, t) : null,
          )}
        </span>
      </fieldset>
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <div className='mt-2 flex flex-wrap gap-2.5'>
        <button
          type='submit'
          disabled={
            submitting || title.trim().length === 0 || body.trim().length === 0
          }
          className={PRIMARY_BUTTON}
        >
          {submitLabel}
        </button>
        <button type='button' onClick={onCancel} className={SECONDARY_BUTTON}>
          {t.common.cancel}
        </button>
        {onDelete ? (
          <button
            type='button'
            onClick={onDelete}
            className={`${SECONDARY_BUTTON} ml-auto`}
          >
            {t.admin.remove}
          </button>
        ) : null}
      </div>
    </form>
  );
}
