import {useAdminAccount} from '@brfhub/core/admin/account';
import {
  checkKind,
  failureMessage,
  stepMaxActive,
  type KindFields,
} from '@brfhub/core/admin/drafts';
import {fieldLabel, type Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import {useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {SECONDARY_BUTTON} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

type KindFormProps = {
  initial: KindFields;
  submitLabel: string;
  onSubmit: (fields: KindFields) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  // Whether resources are of the type, so bookings may be held under it.
  inUse?: boolean;
};

export function KindForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  inUse = false,
}: KindFormProps) {
  const t = useMessages();
  const {locales} = useAdminAccount();
  const [name, setName] = useState<Draft>(initial.name);
  const [maxActive, setMaxActive] = useState(initial.maxActive);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checked = checkKind({name, maxActive}, initial, locales, t);
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

  // Only a lower limit on a type in use can leave an apartment holding more
  // than it allows.
  const lowered = inUse && maxActive < initial.maxActive;

  const step = (by: number) =>
    setMaxActive((previous) => stepMaxActive(previous, by));

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
          label={fieldLabel(t.admin.kindForm.name, language, locales, t)}
          required
          value={name[language] ?? ''}
          onChange={(event) =>
            setName({...name, [language]: event.target.value})
          }
          onBlur={() => leave(`name.${language}`)}
          problem={problem(`name.${language}`)}
        />
      ))}
      <div className='flex items-center justify-between gap-4 rounded-card border border-theme-line bg-theme-surface px-4.5 py-3'>
        <span className='flex flex-col gap-0.5'>
          <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
            {t.admin.kindForm.limit}
          </span>
          <span className='text-[13px] leading-5 text-theme-muted'>
            {t.admin.kindForm.limitHint}
          </span>
        </span>
        <span className='flex items-center gap-3'>
          <button
            type='button'
            aria-label={t.admin.kindForm.fewer}
            onClick={() => step(-1)}
            disabled={stepMaxActive(maxActive, -1) === maxActive}
            className='h-10 w-10 rounded-full border border-theme-edge text-lg text-theme-ink transition-colors hover:bg-theme-sunk disabled:opacity-35'
          >
            −
          </button>
          <span className='w-5 text-center text-lg font-semibold tabular-nums text-theme-ink'>
            {maxActive}
          </span>
          <button
            type='button'
            aria-label={t.admin.kindForm.more}
            onClick={() => step(1)}
            disabled={stepMaxActive(maxActive, 1) === maxActive}
            className='h-10 w-10 rounded-full border border-theme-edge text-lg text-theme-ink transition-colors hover:bg-theme-sunk disabled:opacity-35'
          >
            +
          </button>
        </span>
      </div>
      {lowered ? (
        <p className='text-[13px] leading-5 text-theme-muted'>
          {t.admin.kindForm.limitNote}
        </p>
      ) : null}
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
            {t.admin.kindForm.remove}
          </button>
        ) : null}
      </FormActions>
    </form>
  );
}
