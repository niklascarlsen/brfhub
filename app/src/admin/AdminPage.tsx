import Ionicons from '@expo/vector-icons/Ionicons';
import {useEffect, useRef, type ReactNode} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAdminAccount} from '@/admin/account';
import {untranslatedMessage} from '@/admin/localized';
import {useConfirmLeave} from '@/admin/unsaved';
import {NoticeBar} from '@/components/Notice';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

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
// changes asks first.
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
  const scroll = useRef<ScrollView>(null);
  const missing = untranslatedMessage(untranslated, t);

  // A step to another page starts at its top.
  useEffect(() => {
    scroll.current?.scrollTo({y: 0, animated: false});
  }, [title, back?.label]);

  return (
    <SafeAreaView className='flex-1 bg-theme-bg' edges={['top']}>
      <KeyboardAvoidingView
        className='flex-1'
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          className='flex-1'
          contentContainerClassName='grow px-5 pb-8 pt-2'
          keyboardShouldPersistTaps='handled'
        >
          {back ? (
            <Pressable
              onPress={() => confirmLeave(back.onPress)}
              hitSlop={8}
              className='-ml-1 mb-2 mt-1 flex-row items-center gap-1 self-start py-1 pr-2 active:opacity-60'
            >
              <Ionicons name='chevron-back' size={16} color={theme.muted} />
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
