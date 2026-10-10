import {useState} from 'react';
import {Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
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

  const trimmed = {
    label: fields.label.trim(),
    residentName: fields.residentName.trim(),
    email: fields.email.trim(),
  };
  const dirty =
    trimmed.label !== initial.label ||
    trimmed.residentName !== initial.residentName ||
    trimmed.email !== initial.email;
  const valid =
    trimmed.residentName.length > 0 &&
    trimmed.email.length > 0 &&
    (!withLabel || trimmed.label.length > 0);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmed);
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
    <View className='gap-3'>
      {withLabel ? (
        <FloatingLabelInput
          label={t.admin.apartmentForm.number}
          value={fields.label}
          onChangeText={set('label')}
          maxLength={20}
          autoCorrect={false}
          returnKeyType='next'
        />
      ) : null}
      <FloatingLabelInput
        label={t.admin.apartmentForm.residentName}
        value={fields.residentName}
        onChangeText={set('residentName')}
        maxLength={100}
        autoCapitalize='words'
        autoCorrect={false}
        returnKeyType='next'
      />
      <FloatingLabelInput
        label={t.common.email}
        value={fields.email}
        onChangeText={set('email')}
        autoCapitalize='none'
        autoComplete='off'
        autoCorrect={false}
        keyboardType='email-address'
        returnKeyType='done'
      />
      {note ? (
        <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
          {note}
        </Text>
      ) : null}
      {error ? (
        <Text
          accessibilityRole='alert'
          className='font-sans text-sm text-theme-ink'
        >
          {error}
        </Text>
      ) : null}
      <FormActions
        submitLabel={submitLabel}
        dirty={dirty}
        valid={valid}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}
