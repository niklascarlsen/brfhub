import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Pressable, Switch, Text, TextInput, View} from 'react-native';

import {nextSlot} from '@/admin/schedule';
import {SECONDARY_BUTTON, SECONDARY_LABEL} from '@/admin/styles';
import type {SlotInput} from '@/api/client';
import theme from '@/theme.json';

type SlotsEditorProps = {
  slots: SlotInput[];
  onChange: (slots: SlotInput[]) => void;
};

// "730" or "7.30" becomes "07:30", so the keypad's digits are enough.
function normalizedTime(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);

  if (digits.length < 3) {
    return digits.length === 0 ? '' : `${digits.padStart(2, '0')}:00`;
  }

  const padded = digits.padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

// Every keystroke reaches the slot, so a save without leaving the field
// still sends what was typed; leaving it shows the tidied time.
function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);

  return (
    <View className='min-w-[96px] flex-1 gap-1'>
      <Text className='text-xs font-medium text-theme-muted'>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(next) => {
          setText(next);
          onChange(normalizedTime(next));
        }}
        onEndEditing={() => setText(normalizedTime(text))}
        keyboardType='numbers-and-punctuation'
        maxLength={5}
        accessibilityLabel={label}
        className='h-11 rounded-sm border border-theme-edge bg-theme-surface px-3 text-base text-theme-ink'
        style={{
          fontFamily: 'Merriweather_400Regular',
          fontVariant: ['tabular-nums'],
        }}
      />
    </View>
  );
}

export function SlotsEditor({slots, onChange}: SlotsEditorProps) {
  const update = (index: number, change: Partial<SlotInput>) =>
    onChange(
      slots.map((slot, at) => (at === index ? {...slot, ...change} : slot)),
    );

  return (
    <View className='gap-2.5'>
      {slots.map((slot, index) => (
        <View
          // The fields keep what is typed, so they start over when a row
          // is removed and the rows below move up.
          key={`${index}-${slots.length}`}
          className='gap-3 rounded-2xl border border-theme-line bg-theme-surface px-3.5 py-3'
        >
          <View className='flex-row gap-2.5'>
            <TimeField
              label='Börjar'
              value={slot.start}
              onChange={(start) => update(index, {start})}
            />
            <TimeField
              label='Slutar'
              value={slot.end}
              onChange={(end) => update(index, {end})}
            />
          </View>
          <View className='flex-row items-center justify-between'>
            <View className='flex-row items-center gap-2'>
              <Switch
                value={slot.endOffsetDays === 1}
                onValueChange={(next) =>
                  update(index, {endOffsetDays: next ? 1 : 0})
                }
                trackColor={{true: theme.ink, false: theme.track}}
                thumbColor={theme.surface}
                ios_backgroundColor={theme.track}
              />
              <Text className='font-sans text-[13px] text-theme-ink'>
                Slutar nästa dag
              </Text>
            </View>
            <Pressable
              onPress={() => onChange(slots.filter((_, at) => at !== index))}
              disabled={slots.length === 1}
              hitSlop={8}
              className='px-2 py-1 active:opacity-60 disabled:opacity-35'
            >
              <Text className='text-[13px] font-semibold text-theme-muted'>
                Ta bort
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => onChange([...slots, nextSlot(slots)])}
        disabled={slots.length >= 24}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        <Ionicons name='add' size={18} color={theme.ink} />
        <Text className={SECONDARY_LABEL}>Lägg till pass</Text>
      </Pressable>
    </View>
  );
}
