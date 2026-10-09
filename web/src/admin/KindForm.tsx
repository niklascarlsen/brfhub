import {useState, type SubmitEvent} from 'react';

import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';

export type KindFields = {name: string; maxActive: number};

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
  const [name, setName] = useState(initial.name);
  const [maxActive, setMaxActive] = useState(initial.maxActive);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({name: name.trim(), maxActive});
    } catch (caught) {
      setError(errorMessage(codeOf(caught)));
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
      <FloatingLabelInput
        label='Namn, till exempel Tvätt'
        required
        maxLength={40}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className='flex items-center justify-between gap-4 rounded-2xl border border-theme-line bg-theme-surface px-4.5 py-3'>
        <span className='flex flex-col gap-0.5'>
          <span className='text-[15px] font-semibold tracking-tight text-theme-ink'>
            Bokningar åt gången
          </span>
          <span className='text-[13px] leading-5 text-theme-muted'>
            Per lägenhet, för alla resurser av typen tillsammans
          </span>
        </span>
        <span className='flex items-center gap-3'>
          <button
            type='button'
            aria-label='Färre'
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
            aria-label='Fler'
            onClick={() => step(1)}
            disabled={maxActive >= MAX_ACTIVE}
            className='h-10 w-10 rounded-full border border-theme-edge text-lg text-theme-ink transition-colors hover:bg-theme-sunk disabled:opacity-35'
          >
            +
          </button>
        </span>
      </div>
      <p className='text-[13px] leading-5 text-theme-muted'>
        En ändrad gräns gäller nya bokningar. De som redan är gjorda står kvar.
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
          Avbryt
        </button>
        {onDelete ? (
          <button
            type='button'
            onClick={onDelete}
            className={`${SECONDARY_BUTTON} ml-auto`}
          >
            Ta bort typen
          </button>
        ) : null}
      </div>
    </form>
  );
}
