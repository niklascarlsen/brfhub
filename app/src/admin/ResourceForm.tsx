import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {useAdminAccount} from '@/admin/account';
import {
  fieldLabel,
  isWritten,
  isWrittenOrEmpty,
  tagsOf,
  trimmedText,
  type Draft,
} from '@/admin/localized';
import {slotsProblem} from '@/admin/schedule';
import {SlotsEditor} from '@/admin/SlotsEditor';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import type {
  AdminKind,
  LocalizedTags,
  LocalizedText,
  SlotInput,
} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';
import {localize} from '@/i18n/catalog';
import {useLocale, useMessages} from '@/i18n/LocaleProvider';

export type ResourceFields = {
  name: LocalizedText;
  kindId: string;
  tags: LocalizedTags;
  slots: SlotInput[];
};

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
  const [tags, setTags] = useState<Draft>(() =>
    Object.fromEntries(
      Object.entries(initial.tags).map(([language, list]) => [
        language,
        list.join(', '),
      ]),
    ),
  );
  const [slots, setSlots] = useState(initial.slots);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const tagLists = Object.fromEntries(
      locales.map((language) => [language, tagsOf(tags[language] ?? '')]),
    );
    const problem = !isWrittenOrEmpty(tagLists, locales)
      ? t.admin.localized.tagsInEvery
      : withSlots
        ? slotsProblem(slots, t)
        : null;

    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmedText(name, locales),
        kindId,
        tags: tagLists,
        slots,
      });
    } catch (caught) {
      setError(errorMessage(codeOf(caught), t));
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
          maxLength={40}
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
        />
      ))}
      {withSlots ? (
        <View className='mt-3'>
          <Text className={SECTION_LABEL}>{t.admin.resourceForm.slots}</Text>
          <SlotsEditor slots={slots} onChange={setSlots} />
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
      <View className='mt-2 flex-row flex-wrap gap-2.5'>
        <Pressable
          onPress={() => void submit()}
          disabled={submitting || kindId === '' || !isWritten(name, locales)}
          className={PRIMARY_BUTTON}
        >
          <Text className={PRIMARY_LABEL}>{submitLabel}</Text>
        </Pressable>
        <Pressable onPress={onCancel} className={SECONDARY_BUTTON}>
          <Text className={SECONDARY_LABEL}>{t.common.cancel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
