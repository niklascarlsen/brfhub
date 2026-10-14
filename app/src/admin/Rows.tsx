import {Icon} from '@/components/Icon';
import type {ReactNode} from 'react';
import {Pressable, Text, View} from 'react-native';

import theme from '@/theme.json';

// A fact on a detail page, its name to the left and its value to the right.
export function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-baseline justify-between gap-4 py-2.5 ${
        last ? '' : 'border-b border-theme-line'
      }`}
    >
      <Text className='shrink-0 font-sans text-[13px] text-theme-muted'>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        className='min-w-0 flex-1 text-right font-sans text-sm text-theme-ink'
      >
        {value}
      </Text>
    </View>
  );
}

type ActionRowProps = {
  label: string;
  // A line on what is there now, under the label.
  description?: string;
  // Something that wants the admin's attention, beside the label.
  badge?: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  last?: boolean;
};

// A row in a list of steps down: what it opens, a line on what is there,
// and a chevron.
export function ActionRow({
  label,
  description,
  badge,
  disabled = false,
  onPress,
  last,
}: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 px-[18px] py-3.5 active:bg-theme-sunk ${
        last ? '' : 'border-b border-theme-line'
      }`}
    >
      <View className='min-w-0 flex-1 gap-0.5'>
        <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
          {label}
        </Text>
        {description ? (
          <Text
            numberOfLines={2}
            className='font-sans text-[13px] leading-5 text-theme-muted'
          >
            {description}
          </Text>
        ) : null}
      </View>
      {badge}
      <Icon name='chevron-forward' size={16} color={theme.faint} />
    </Pressable>
  );
}

// A count of what needs doing, such as admins without two-step.
export function Badge({children}: {children: string}) {
  return (
    <View className='shrink-0 rounded-full bg-theme-danger/10 px-2 py-0.5'>
      <Text className='text-xs font-semibold text-theme-danger'>
        {children}
      </Text>
    </View>
  );
}
