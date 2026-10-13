import {useAdminAccount} from '@booking/core/admin/account';
import {
  fieldLabel,
  isWritten,
  trimmedText,
  type Draft,
} from '@booking/core/admin/localized';
import {codeOf, errorMessage} from '@booking/core/api/errors';
import type {LocalizedText} from '@booking/core/api/types';
import {useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {SECONDARY_BUTTON} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

export type KindFields = {name: LocalizedText; maxActive: number};

type KindFormProps = {
  initial: KindFields;
  submitLabel: string;
  onSubmit: (fields: KindFields) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

const MAX_ACTIVE = 10;

export function KindForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: KindFormProps) {
  const t = useMessages();
  const {locales} = useAdminAccount();
  const [name, setName] = useState<Draft>(initial.name);
  const [maxActive, setMaxActive] = useState(initial.maxActive);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirty =
    JSON.stringify(trimmedText(name, locales)) !==
      JSON.stringify(trimmedText(initial.name, locales)) ||
    maxActive !== initial.maxActive;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({name: trimmedText(name, locales), maxActive});
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
      setSubmitting(false);
    }
  }

  const step = (by: number) =>
    setMaxActive((previous) =>
      Math.min(MAX_ACTIVE, Math.max(1, previous + by)),
    );

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          lang={language}
          label={fieldLabel(t.admin.kindForm.name, language, locales, t)}
          required
          maxLength={40}
          value={name[language] ?? ''}
          onChange={(event) =>
            setName({...name, [language]: event.target.value})
          }
        />
      ))}
      <div className='flex items-center justify-between gap-4 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-3'>
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
            disabled={maxActive <= 1}
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
            disabled={maxActive >= MAX_ACTIVE}
            className='h-10 w-10 rounded-full border border-theme-edge text-lg text-theme-ink transition-colors hover:bg-theme-sunk disabled:opacity-35'
          >
            +
          </button>
        </span>
      </div>
      <p className='text-[13px] leading-5 text-theme-muted'>
        {t.admin.kindForm.limitNote}
      </p>
      {error ? (
        <p role='alert' className='text-sm text-theme-ink'>
          {error}
        </p>
      ) : null}
      <FormActions
        submitLabel={submitLabel}
        dirty={dirty}
        valid={isWritten(name, locales)}
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
