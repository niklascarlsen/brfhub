import {useAdminAccount} from '@brfhub/core/admin/account';
import {
  checkResource,
  failureMessage,
  tagsText,
  type ResourceFields,
} from '@brfhub/core/admin/drafts';
import {fieldLabel, type Draft} from '@brfhub/core/admin/localized';
import {useProblems} from '@brfhub/core/admin/useProblems';
import type {AdminKind} from '@brfhub/core/api/types';
import {localize} from '@brfhub/core/i18n/catalog';
import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {FormActions} from '@/admin/FormActions';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {SECTION_LABEL} from '@/admin/styles';
import {FieldProblem} from '@/components/FieldProblem';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

type ResourceFormProps = {
  kinds: AdminKind[];
  initial: ResourceFields;
  // A new resource sets its first times here; later ones go through the
  // schedule, which has its own rules.
  withSlots: boolean;
  submitLabel: string;
  onSubmit: (fields: ResourceFields) => Promise<void>;
  onCancel: () => void;
};

export function ResourceForm({
  kinds,
  initial,
  withSlots,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps) {
  const t = useMessages();
  const {locale} = useLocale();
  const {locales} = useAdminAccount();
  const [name, setName] = useState<Draft>(initial.name);
  const [kindId, setKindId] = useState(initial.kindId);
  const [tags, setTags] = useState<Draft>(() => tagsText(initial.tags));
  const [slots, setSlots] = useState(initial.slots);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checked = checkResource(
    {name, kindId, tags, slots},
    initial,
    {locales, withSlots},
    t,
  );
  const {problem, leave, ready} = useProblems(checked);
  const slotsProblem = problem('slots');

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

  return (
    <View className='gap-3'>
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          label={fieldLabel(t.admin.resourceForm.name, language, locales, t)}
          value={name[language] ?? ''}
          onChangeText={(text) => setName({...name, [language]: text})}
          onBlur={() => leave(`name.${language}`)}
          problem={problem(`name.${language}`)}
          autoCapitalize='sentences'
        />
      ))}
      <View className='gap-2'>
        <Text className='text-[13px] font-medium text-theme-muted'>
          {t.admin.resource.kind}
        </Text>
        <View className='flex-row flex-wrap gap-2'>
          {kinds.map((kind) => {
            const selected = kind.id === kindId;

            return (
              <Pressable
                key={kind.id}
                accessibilityState={{selected}}
                onPress={() => setKindId(kind.id)}
                className={`h-10 justify-center rounded-full border px-4 ${
                  selected
                    ? 'border-theme-ink bg-theme-ink'
                    : 'border-theme-edge bg-theme-surface active:bg-theme-sunk'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? 'text-theme-surface' : 'text-theme-ink'
                  }`}
                >
                  {localize(kind.name, locale)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {locales.map((language) => (
        <FloatingLabelInput
          key={language}
          label={fieldLabel(t.admin.resourceForm.tags, language, locales, t)}
          value={tags[language] ?? ''}
          onChangeText={(text) => setTags({...tags, [language]: text})}
          onBlur={() => leave(`tags.${language}`)}
          problem={problem(`tags.${language}`)}
        />
      ))}
      {withSlots ? (
        <View className='mt-3'>
          <Text className={SECTION_LABEL}>{t.admin.resourceForm.slots}</Text>
          <SlotsEditor slots={slots} onChange={setSlots} />
          {slotsProblem ? <FieldProblem message={slotsProblem} /> : null}
        </View>
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
