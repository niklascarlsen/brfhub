import {useAdminAccount} from '@booking/core/admin/account';
import {untranslatedMessage} from '@booking/core/admin/localized';
import {Icon} from '@/components/Icon';
import {useEffect, useRef, type ReactNode} from 'react';
import {Pressable, Text, View} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useConfirmLeave} from '@/admin/unsaved';
import {NoticeBar} from '@/components/Notice';
import {usePageEnd} from '@/components/TabBar';
import {useMessages} from '@/i18n/LocaleProvider';
import {theme} from '@/theme';

// The focused field stays this far above the keyboard: clear of the
// toolbar on it (42, which the library does not export) and a little more.
const KEYBOARD_GAP = 42 + 24;

type AdminPageProps = {
  title: string;
  subtitle: string;
  back?: {label: string; onPress: () => void};
  action?: ReactNode;
  children: ReactNode;
};

// One admin page: a back link when it is a step down, the title, a bar
// while some of the organization's text lacks a language, an optional
// action under it, and the content. Going back from a form with unsaved
// changes asks first. The keyboard scrolls the focused field into view,
// with a bar above it to step between the fields, since the window does
// not shrink on Android.
export function AdminPage({
  title,
  subtitle,
  back,
  action,
  children,
}: AdminPageProps) {
  const t = useMessages();
  const {untranslated} = useAdminAccount();
  const confirmLeave = useConfirmLeave();
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const pageEnd = usePageEnd();
  const missing = untranslatedMessage(untranslated, t);

  // A step to another page starts at its top.
  useEffect(() => {
    scroll.current?.scrollTo({y: 0, animated: false});
  }, [title, back?.label]);

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <KeyboardAwareScrollView
        ref={scroll}
        bottomOffset={KEYBOARD_GAP}
        className='flex-1'
        contentContainerClassName='grow px-5 pt-2'
        contentContainerStyle={{paddingBottom: pageEnd}}
        keyboardShouldPersistTaps='handled'
      >
        {back ? (
          <Pressable
            onPress={() => confirmLeave(back.onPress)}
            hitSlop={8}
            className='-ml-1 mb-2 mt-1 flex-row items-center gap-1 self-start py-1 pr-2 active:opacity-60'
          >
            <Icon name='chevron-back' size={16} color={theme.muted} />
            <Text className='text-sm font-semibold text-theme-muted'>
              {back.label}
            </Text>
          </Pressable>
        ) : null}
        <Text className='text-[27px] font-semibold tracking-tight text-theme-ink'>
          {title}
        </Text>
        <Text className='mb-6 mt-1 font-sans text-[13px] text-theme-muted'>
          {subtitle}
        </Text>
        {missing ? (
          <View className='-mt-2 mb-2'>
            <NoticeBar message={missing} />
          </View>
        ) : null}
        {action ? <View className='mb-6'>{action}</View> : null}
        {children}
      </KeyboardAwareScrollView>
      <KeyboardToolbar>
        <KeyboardToolbar.Prev />
        <KeyboardToolbar.Next />
        <KeyboardToolbar.Done text={t.common.ok} />
      </KeyboardToolbar>
    </SafeAreaView>
  );
}
