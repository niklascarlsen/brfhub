import {
  checkApartment,
  failureMessage,
  type ApartmentFields,
} from '@brfhub/core/admin/drafts';
import {useProblems} from '@brfhub/core/admin/useProblems';
import {useState, type SubmitEvent} from 'react';

import {FormActions} from '@/admin/FormActions';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

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
  const checked = checkApartment(fields, initial, withLabel, t);
  const {problem, leave, ready} = useProblems(checked);

  const set = (key: keyof ApartmentFields) => (value: string) =>
    setFields((previous) => ({...previous, [key]: value}));

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
      // The server checks the email more closely than the field does.
      setError(failureMessage(caught, t, t.admin.apartmentForm.checkEmail));
      setSubmitting(false);
    }
  }

  // The fields say what is wrong themselves, so the browser's own checks
  // stay out of the way.
  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-3'
    >
      {withLabel ? (
        <FloatingLabelInput
          label={t.admin.apartmentForm.number}
          name='label'
          required
          value={fields.label}
          onChange={(event) => set('label')(event.target.value)}
          onBlur={() => leave('label')}
          problem={problem('label')}
        />
      ) : null}
      <FloatingLabelInput
        label={t.admin.apartmentForm.residentName}
        name='residentName'
        autoComplete='off'
        required
        value={fields.residentName}
        onChange={(event) => set('residentName')(event.target.value)}
        onBlur={() => leave('residentName')}
        problem={problem('residentName')}
      />
      <FloatingLabelInput
        label={t.common.email}
        type='email'
        name='email'
        autoComplete='off'
        inputMode='email'
        autoCapitalize='none'
        required
        value={fields.email}
        onChange={(event) => set('email')(event.target.value)}
        onBlur={() => leave('email')}
        problem={problem('email')}
      />
      {note ? (
        <p className='text-[13px] leading-5 text-theme-muted'>{note}</p>
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
      />
    </form>
  );
}
