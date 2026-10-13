import {useAdminAccount} from '@booking/core/admin/account';
import {
  DURATIONS,
  durationOf,
  endsOnAfter,
  startOf,
} from '@booking/core/admin/announcement';
import {
  checkAnnouncement,
  failureMessage,
  type AnnouncementFields,
} from '@booking/core/admin/drafts';
import {fieldLabel, type Draft} from '@booking/core/admin/localized';
import {useProblems} from '@booking/core/admin/useProblems';
import {formatLongDate} from '@booking/core/lib/dates';
import {useId, useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {SECONDARY_BUTTON} from '@/admin/styles';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

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
  const formId = useId();
  // A new duration counts from today, also when an older announcement is
  // given more days.
  const start = startOf(initial.publishedOn, today);
  const duration = durationOf(start, endsOn);
  const checked = checkAnnouncement({title, body, endsOn}, initial, locales, t);
  const {problem, leave, ready} = useProblems(checked);

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
      className='flex flex-col gap-3'
    >
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          lang={language}
          label={fieldLabel(
            t.admin.announcementForm.title,
            language,
            locales,
            t,
          )}
          required
          value={title[language] ?? ''}
          onChange={(event) =>
            setTitle({...title, [language]: event.target.value})
          }
          onBlur={() => leave(`title.${language}`)}
          problem={problem(`title.${language}`)}
        />
      ))}
      {locales.map((language) => {
        const shown = problem(`body.${language}`);
        const problemId = `${formId}-body-${language}`;

        return (
          <div key={language}>
            <label className='flex flex-col gap-1.5'>
              <span className='text-[13px] font-medium text-theme-muted'>
                {fieldLabel(
                  t.admin.announcementForm.body,
                  language,
                  locales,
                  t,
                )}
              </span>
              <textarea
                lang={language}
                required
                rows={6}
                value={body[language] ?? ''}
                onChange={(event) =>
                  setBody({...body, [language]: event.target.value})
                }
                onBlur={() => leave(`body.${language}`)}
                aria-invalid={shown ? true : undefined}
                aria-describedby={shown ? problemId : undefined}
                className={`w-full rounded-xs border bg-theme-surface px-4 py-3 text-base leading-6 text-theme-ink ${
                  shown
                    ? 'border-theme-danger'
                    : 'border-theme-edge focus:border-theme-ink'
                }`}
              />
            </label>
            {shown ? <FieldProblem id={problemId} message={shown} /> : null}
          </div>
        );
      })}
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
      <FormActions
        submitLabel={submitLabel}
        dirty={checked.changed}
        submitting={submitting}
        onCancel={onCancel}
      >
        {onDelete ? (
          <button
            type='button'
            onClick={onDelete}
            className={`${SECONDARY_BUTTON} ml-auto`}
          >
            {t.admin.remove}
          </button>
        ) : null}
      </FormActions>
    </form>
  );
}
