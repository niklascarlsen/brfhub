import {useAdminAccount} from '@booking/core/admin/account';
import {
  checkKind,
  failureMessage,
  stepMaxActive,
  type KindFields,
} from '@booking/core/admin/drafts';
import {fieldLabel, type Draft} from '@booking/core/admin/localized';
import {useProblems} from '@booking/core/admin/useProblems';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {SECONDARY_BUTTON, SECONDARY_LABEL} from '@/admin/styles';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useMessages} from '@/i18n/LocaleProvider';

type KindFormProps = {
  initial: KindFields;
  submitLabel: string;
  onSubmit: (fields: KindFields) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

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
  const t = useMessages();
  const {locales} = useAdminAccount();
  const [name, setName] = useState<Draft>(initial.name);
  const [maxActive, setMaxActive] = useState(initial.maxActive);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checked = checkKind({name, maxActive}, initial, locales, t);
  const {problem, leave, ready} = useProblems(checked);

  async function submit() {
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

  const step = (by: number) =>
    setMaxActive((previous) => stepMaxActive(previous, by));

  return (
    <View className='gap-3'>
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          label={fieldLabel(t.admin.kindForm.name, language, locales, t)}
          value={name[language] ?? ''}
          onChangeText={(text) => setName({...name, [language]: text})}
          onBlur={() => leave(`name.${language}`)}
          problem={problem(`name.${language}`)}
          autoCapitalize='sentences'
        />
      ))}
      <View className='flex-row items-center justify-between gap-4 rounded-card border border-theme-line bg-theme-surface px-[18px] py-3'>
        <View className='min-w-0 flex-1 gap-0.5'>
          <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
            {t.admin.kindForm.limit}
          </Text>
          <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
            {t.admin.kindForm.limitHint}
          </Text>
        </View>
        <View className='flex-row items-center gap-3'>
          <StepButton
            label={t.admin.kindForm.fewer}
            glyph='−'
            disabled={stepMaxActive(maxActive, -1) === maxActive}
            onPress={() => step(-1)}
          />
          <Text className='w-5 text-center text-lg font-semibold text-theme-ink'>
            {maxActive}
          </Text>
          <StepButton
            label={t.admin.kindForm.more}
            glyph='+'
            disabled={stepMaxActive(maxActive, 1) === maxActive}
            onPress={() => step(1)}
          />
        </View>
      </View>
      <Text className='font-sans text-[13px] leading-5 text-theme-muted'>
        {t.admin.kindForm.limitNote}
      </Text>
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
      >
        {onDelete ? (
          <Pressable onPress={onDelete} className={SECONDARY_BUTTON}>
            <Text className={SECONDARY_LABEL}>{t.admin.kindForm.remove}</Text>
          </Pressable>
        ) : null}
      </FormActions>
    </View>
  );
}
