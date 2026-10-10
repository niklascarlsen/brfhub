import {useState, type SubmitEvent} from 'react';

import {PRIMARY_BUTTON, SECONDARY_BUTTON} from '@/admin/styles';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

export type ApartmentFields = {
  label: string;
  residentName: string;
  email: string;
};

type ApartmentFormProps = {
  initial: ApartmentFields;
  // A new resident keeps the apartment's number.
  withLabel: boolean;
  note?: string;
  submitLabel: string;
  onSubmit: (fields: ApartmentFields) => Promise<void>;
  onCancel: () => void;
};

export function ApartmentForm({
  initial,
  withLabel,
  note,
  submitLabel,
  onSubmit,
  onCancel,
}: ApartmentFormProps) {
  const t = useMessages();
  const [fields, setFields] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof ApartmentFields) => (value: string) =>
    setFields((previous) => ({...previous, [key]: value}));

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        label: fields.label.trim(),
        residentName: fields.residentName.trim(),
        email: fields.email.trim(),
      });
    } catch (caught) {
      const code = codeOf(caught);
      // The server checks the email more closely than the field does.
      setError(
        code === 'VALIDATION'
          ? t.admin.apartmentForm.checkEmail
          : errorMessage(code, t),
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      {withLabel ? (
        <FloatingLabelInput
          label={t.admin.apartmentForm.number}
          name='label'
          required
          maxLength={20}
          value={fields.label}
          onChange={(event) => set('label')(event.target.value)}
        />
      ) : null}
      <FloatingLabelInput
        label={t.admin.apartmentForm.residentName}
        name='residentName'
        autoComplete='off'
        required
        maxLength={100}
        value={fields.residentName}
        onChange={(event) => set('residentName')(event.target.value)}
      />
      <FloatingLabelInput
        label={t.login.email}
        type='email'
        name='email'
        autoComplete='off'
        inputMode='email'
        autoCapitalize='none'
        required
        value={fields.email}
        onChange={(event) => set('email')(event.target.value)}
      />
      {note ? (
        <p className='text-[13px] leading-5 text-theme-muted'>{note}</p>
      ) : null}
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
      </div>
    </form>
  );
}
