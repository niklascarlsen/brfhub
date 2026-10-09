import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
} from '@/admin/styles';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';

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
  const canSubmit =
    !submitting &&
    trimmed.residentName.length > 0 &&
    trimmed.email.length > 0 &&
    (!withLabel || trimmed.label.length > 0);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmed);
    } catch (caught) {
      setError(errorMessage(codeOf(caught)));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-3'>
      {withLabel ? (
        <FloatingLabelInput
          label='Lägenhetsnummer'
          value={fields.label}
          onChangeText={set('label')}
          maxLength={20}
          autoCorrect={false}
          returnKeyType='next'
        />
      ) : null}
      <FloatingLabelInput
        label='De boendes namn'
        value={fields.residentName}
        onChangeText={set('residentName')}
        maxLength={100}
        autoCapitalize='words'
        autoCorrect={false}
        returnKeyType='next'
      />
      <FloatingLabelInput
        label='E-post'
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
      <View className='mt-2 flex-row flex-wrap gap-2.5'>
        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          className={PRIMARY_BUTTON}
        >
          <Text className={PRIMARY_LABEL}>{submitLabel}</Text>
        </Pressable>
        <Pressable onPress={onCancel} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>Avbryt</Text>
        </Pressable>
      </View>
    </View>
  );
}
