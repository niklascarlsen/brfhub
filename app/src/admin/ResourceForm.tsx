import {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

import {SlotsEditor} from '@/admin/SlotsEditor';
import {
  PRIMARY_BUTTON,
  PRIMARY_LABEL,
  SECONDARY_BUTTON,
  SECONDARY_LABEL,
  SECTION_LABEL,
} from '@/admin/styles';
import type {AdminKind, SlotInput} from '@/api/client';
import {codeOf, errorMessage} from '@/api/errors';
import {FloatingLabelInput} from '@/components/FloatingLabelInput';

export type ResourceFields = {
  name: string;
  kindId: string;
  tags: string[];
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

function tagsOf(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function ResourceForm({
  kinds,
  initial,
  withSlots,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps) {
  const [name, setName] = useState(initial.name);
  const [kindId, setKindId] = useState(initial.kindId);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [slots, setSlots] = useState(initial.slots);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({name: name.trim(), kindId, tags: tagsOf(tags), slots});
    } catch (caught) {
      setError(errorMessage(codeOf(caught)));
      setSubmitting(false);
    }
  }

  return (
    <View className='gap-3'>
      <FloatingLabelInput
        label='Namn, till exempel Tvättstuga 1'
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoCapitalize='sentences'
      />
      <View className='gap-2'>
        <Text className='text-[13px] font-medium text-theme-muted'>Typ</Text>
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
                  {kind.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <FloatingLabelInput
        label='Taggar, åtskilda med komma'
        value={tags}
        onChangeText={setTags}
      />
      {withSlots ? (
        <View className='mt-3'>
          <Text className={SECTION_LABEL}>Pass</Text>
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
          disabled={submitting || kindId === '' || name.trim().length === 0}
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
