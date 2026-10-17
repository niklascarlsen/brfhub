import {Icon} from '@/components/Icon';
import {Pressable, Text, View} from 'react-native';

import {theme} from '@/theme';

type NoticeProps = {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function Notice({title, message, actionLabel, onAction}: NoticeProps) {
  return (
    <View className='grow items-center justify-center px-8 py-12'>
      {title ? (
        <Text className='mb-2 text-center text-xl font-semibold text-theme-ink'>
          {title}
        </Text>
      ) : null}
      <Text className='text-center font-sans text-sm leading-5 text-theme-muted'>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} className='mt-3 active:opacity-60'>
          <Text className='text-base font-semibold text-theme-accent'>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type NoticeBarProps = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function NoticeBar({message, actionLabel, onAction}: NoticeBarProps) {
  return (
    <View className='mb-4 flex-row items-center gap-2.5 rounded-xl border border-theme-edge bg-theme-sunk py-2.5 pl-3.5 pr-2.5'>
      <Icon name='alert-circle' size={18} color={theme.ink} />
      <Text className='min-w-0 flex-1 text-[13px] font-medium leading-[18px] text-theme-ink'>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          className='h-8 items-center justify-center rounded-full border border-theme-edge bg-theme-surface px-3.5 active:opacity-70'
        >
          <Text className='text-[13px] font-semibold text-theme-ink'>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
