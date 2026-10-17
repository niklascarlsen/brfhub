import {
  checkApartment,
  failureMessage,
  type ApartmentFields,
} from '@brfhub/core/admin/drafts';
import {useProblems} from '@brfhub/core/admin/useProblems';
import {useState} from 'react';
import {Text, View} from 'react-native';

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

  async function submit() {
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

  return (
    <View className='gap-3'>
      {withLabel ? (
        <FloatingLabelInput
          label={t.admin.apartmentForm.number}
          value={fields.label}
          onChangeText={set('label')}
          onBlur={() => leave('label')}
          problem={problem('label')}
          autoCorrect={false}
          returnKeyType='next'
        />
      ) : null}
      <FloatingLabelInput
        label={t.admin.apartmentForm.residentName}
        value={fields.residentName}
        onChangeText={set('residentName')}
        onBlur={() => leave('residentName')}
        problem={problem('residentName')}
        autoCapitalize='words'
        autoCorrect={false}
        returnKeyType='next'
      />
      <FloatingLabelInput
        label={t.common.email}
        value={fields.email}
        onChangeText={set('email')}
        onBlur={() => leave('email')}
        problem={problem('email')}
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
        dirty={checked.changed}
        submitting={submitting}
        onSubmit={() => void submit()}
        onCancel={onCancel}
      />
    </View>
  );
}
