import {useAdminAccount} from '@booking/core/admin/account';
import {untranslatedMessage} from '@booking/core/admin/localized';
import {Icon} from '@/components/Icon';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {Pressable, Text, View} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useConfirmLeave} from '@/admin/unsaved';
import {NoticeBar} from '@/components/Notice';
import {usePageEnd} from '@/components/TabBar';
import {useMessages} from '@/i18n/LocaleProvider';
import {theme} from '@/theme';

// The focused field stays this far above the keyboard: clear of the
// toolbar on it (42, which the library does not export) and a little more.
const KEYBOARD_GAP = 42 + 24;

// How far the page has scrolled, and a view at the top of what scrolls,
// which a heading that sticks measures itself from. The web's headings
// stick with CSS alone.
type PageScroll = {
  scrollY: SharedValue<number>;
  top: AnimatedRef<Animated.View>;
};

const PageScrollContext = createContext<PageScroll | null>(null);

export function usePageScroll(): PageScroll | null {
  return useContext(PageScrollContext);
}

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
  const scrollY = useSharedValue(0);
  const top = useAnimatedRef<Animated.View>();
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const pageScroll = useMemo(() => ({scrollY, top}), [scrollY, top]);

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
        contentContainerClassName='grow px-5'
        contentContainerStyle={{paddingBottom: pageEnd}}
        keyboardShouldPersistTaps='handled'
        onScroll={onScroll}
      >
        {/* The page's top padding, at the very top of what scrolls. */}
        <Animated.View ref={top} collapsable={false} className='h-2' />
        {back ? (
          <Pressable
            onPress={() => confirmLeave(back.onPress)}
            hitSlop={8}
            className='-ml-1.5 mb-4 mt-2 flex-row items-center gap-0.5 self-start py-1.5 pr-2 active:opacity-60'
          >
            <Icon name='chevron-back' size={22} color={theme.ink} />
            <Text className='text-base font-semibold text-theme-ink'>
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
        <PageScrollContext.Provider value={pageScroll}>
          {children}
        </PageScrollContext.Provider>
      </KeyboardAwareScrollView>
      <KeyboardToolbar>
        <KeyboardToolbar.Prev />
        <KeyboardToolbar.Next />
        <KeyboardToolbar.Done text={t.common.ok} />
      </KeyboardToolbar>
    </SafeAreaView>
  );
}
