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

export type KindFields = {name: string; maxActive: number};

type KindFormProps = {
  initial: KindFields;
  submitLabel: string;
  onSubmit: (fields: KindFields) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

const MAX_ACTIVE = 10;

function StepButton({
  label,
  glyph,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      className='h-10 w-10 items-center justify-center rounded-full border border-theme-edge active:bg-theme-sunk disabled:opacity-35'
    >
      <Text className='font-sans text-lg text-theme-ink'>{glyph}</Text>
    </Pressable>
  );
}

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

  async function submit() {
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
    <View className='gap-3'>
      <FloatingLabelInput
        label='Namn, till exempel Tvätt'
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoCapitalize='sentences'
      />
      <View className='flex-row items-center justify-between gap-4 rounded-2xl border border-theme-line bg-theme-surface px-[18px] py-3'>
        <View className='min-w-0 flex-1 gap-0.5'>
          <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
            Bokningar åt gången
          </Text>
          <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
            Per lägenhet, för alla resurser av typen tillsammans
          </Text>
        </View>
        <View className='flex-row items-center gap-3'>
          <StepButton
            label='Färre'
            glyph='−'
            disabled={maxActive <= 1}
            onPress={() => step(-1)}
          />
          <Text className='w-5 text-center text-lg font-semibold text-theme-ink'>
            {maxActive}
          </Text>
          <StepButton
            label='Fler'
            glyph='+'
            disabled={maxActive >= MAX_ACTIVE}
            onPress={() => step(1)}
          />
        </View>
      </View>
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        En ändrad gräns gäller nya bokningar. De som redan är gjorda står kvar.
      </Text>
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
          disabled={submitting || name.trim().length === 0}
          className={PRIMARY_BUTTON}
        >
          <Text className={PRIMARY_LABEL}>{submitLabel}</Text>
        </Pressable>
        <Pressable onPress={onCancel} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>Avbryt</Text>
        </Pressable>
        {onDelete ? (
          <Pressable onPress={onDelete} className={SECONDARY_BUTTON}>
            <Text className={SECONDARY_LABEL}>Ta bort typen</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
