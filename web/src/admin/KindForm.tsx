import {useState, type SubmitEvent} from 'react';

import {useAdminAccount} from '@/admin/account';
import {fieldLabel, trimmedText, type Draft} from '@/admin/localized';
import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import type {LocalizedText} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
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
      <div className='mt-2 flex flex-wrap gap-2.5'>
        <button type='submit' disabled={submitting} className={PRIMARY_BUTTON}>
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
            {t.admin.kindForm.remove}
          </button>
        ) : null}
      </div>
    </form>
  );
}
