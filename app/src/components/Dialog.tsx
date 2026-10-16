import type {Messages} from '@booking/core/i18n/catalog';
import {
  dismissLabel,
  optionLabels,
  type Dialog,
  type DialogAction,
  type DialogChoice,
  type DialogTime,
} from '@booking/core/lib/dialog';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Icon} from '@/components/Icon';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

type DialogRequest = {
  key: number;
  title: string;
  message: string;
  action?: DialogAction;
  choices?: DialogChoice[];
  choicesLabel?: string;
  times?: DialogTime[];
};

// Dialogs asked while one shows wait their turn, as the platform's alerts
// do. The last one animates out before the modal hides, and one asked
// meanwhile then opens in the same modal. iOS cannot present a modal while
// the last one is still going away, so once hidden the next waits for
// onDismiss; Android has no onDismiss and no such wait.
type DialogState = {
  queue: DialogRequest[];
  phase: 'idle' | 'open' | 'closing' | 'leaving';
  // Up once the modal is on screen, for the screen reader's focus.
  presented: boolean;
  // Still drawn while it animates out.
  last: DialogRequest | null;
};

type DialogEvent =
  | {type: 'ask'; request: DialogRequest}
  | {type: 'close'}
  | {type: 'closed'}
  | {type: 'shown'}
  | {type: 'dismissed'};

function reduce(state: DialogState, event: DialogEvent): DialogState {
  switch (event.type) {
    case 'ask':
      return {
        ...state,
        queue: [...state.queue, event.request],
        phase: state.phase === 'idle' ? 'open' : state.phase,
      };
    case 'close': {
      const [closed, ...rest] = state.queue;

      if (rest.length > 0) {
        return {...state, queue: rest};
      }

      return {
        queue: rest,
        phase: 'closing',
        presented: false,
        last: closed ?? state.last,
      };
    }
    case 'closed':
      // One asked while the last animated out opens in the modal still on
      // screen, so onShow does not come again.
      if (state.queue.length > 0) {
        return {...state, phase: 'open', presented: true};
      }

      return {...state, phase: Platform.OS === 'ios' ? 'leaving' : 'idle'};
    case 'shown':
      return {...state, presented: true};
    case 'dismissed':
      if (state.phase !== 'leaving') {
        return state;
      }

      return {...state, phase: state.queue.length > 0 ? 'open' : 'idle'};
  }
}

const INITIAL: DialogState = {
  queue: [],
  phase: 'idle',
  presented: false,
  last: null,
};

const DialogContext = createContext<Dialog | null>(null);

const BUTTON =
  'min-h-12 flex-1 items-center justify-center rounded-full px-3 py-3 active:opacity-70';
const SECONDARY = `${BUTTON} border border-theme-edge bg-theme-surface`;
const BUTTON_TEXT = 'text-center text-[15px] font-semibold tracking-tight';
const CAPTION = 'text-[11px] font-bold uppercase tracking-[1px]';

// A time given up is red and one gained green, so the two read apart at a
// glance.
const TONES = {
  old: {card: 'bg-theme-danger/[0.08]', caption: 'text-theme-danger'},
  new: {card: 'bg-theme-mist', caption: 'text-theme-accent'},
  none: {card: 'bg-theme-sunk', caption: 'text-theme-muted'},
};

export function useDialog(): Dialog {
  const dialog = useContext(DialogContext);

  if (dialog === null) {
    throw new Error('useDialog must be used inside DialogProvider');
  }

  return dialog;
}

// A time under the message: what it is to the question, where and when.
function TimeLines({time}: {time: DialogTime}) {
  return (
    <>
      {time.caption ? (
        <Text
          className={`mb-1 ${CAPTION} ${TONES[time.tone ?? 'none'].caption}`}
        >
          {time.caption}
        </Text>
      ) : null}
      <Text className='text-[15px] font-semibold tracking-tight text-theme-ink'>
        {time.resource}
      </Text>
      <Text className='mt-0.5 font-sans text-[13px] leading-5 text-theme-muted'>
        {time.when}
      </Text>
    </>
  );
}

function spoken(time: DialogTime): string {
  return [time.caption, time.resource, time.when].filter(Boolean).join(', ');
}

// What a screen reader says after the title and the message as the dialog
// opens: the times and the buttons, as the web's dialog describes itself,
// so the question is whole before the first button is reached.
function hintOf(request: DialogRequest, t: Messages): string {
  return [
    ...(request.times ?? []).map(spoken),
    t.common.dialogOptions(optionLabels(request, t)),
  ].join('. ');
}

// Every dialog the app shows, drawn as the web's is rather than as the
// platform's alert, which holds neither times nor more than three
// buttons on Android. It does by hand what an alert does by itself: fades
// in and grows a little, keeps a screen reader inside the dialog, starts
// it on the title and closes on the escape gesture and the back button.
export function DialogProvider({children}: {children: ReactNode}) {
  const t = useMessages();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [state, send] = useReducer(reduce, INITIAL);
  const [progress] = useState(() => new Animated.Value(0));
  const nextKey = useRef(0);
  const titleRef = useRef<View>(null);
  // While the last one animates out it stays drawn and answers nothing, even
  // if the next one is already waiting.
  const current = state.phase === 'open' ? (state.queue[0] ?? null) : null;
  const request = state.phase === 'closing' ? state.last : current;

  const dialog = useMemo<Dialog>(() => {
    const ask = (request: Omit<DialogRequest, 'key'>) => {
      nextKey.current += 1;
      send({type: 'ask', request: {...request, key: nextKey.current}});
    };

    return {
      alert: (title, message) => ask({title, message}),
      confirm: (title, message, action, times) =>
        ask({title, message, action, times}),
      choose: (title, message, choices, options) =>
        ask({title, message, choices, ...options}),
    };
  }, []);

  // Animated on the native thread, once the dialog is drawn, so it does
  // not stutter while the modal mounts it.
  useEffect(() => {
    if (state.phase === 'open') {
      Animated.timing(progress, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (state.phase === 'closing') {
      Animated.timing(progress, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => send({type: 'closed'}));
    }
  }, [state.phase, progress]);

  // iOS only presents the next modal once told the last one is gone. Should
  // it never say so, the dialogs in line would wait for good.
  useEffect(() => {
    if (state.phase !== 'leaving') {
      return;
    }

    const timer = setTimeout(() => send({type: 'dismissed'}), 500);
    return () => clearTimeout(timer);
  }, [state.phase]);

  // The screen reader starts on the title, also when the next dialog in
  // line takes the place of the last without the modal closing.
  const currentKey = current?.key;
  useEffect(() => {
    if (state.presented && currentKey !== undefined && titleRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }
  }, [state.presented, currentKey]);

  const close = () => {
    if (current !== null) {
      send({type: 'close'});
    }
  };

  // Closing without the action, by its button, the backdrop, the back
  // button or the escape gesture.
  const dismiss = () => {
    if (current === null) {
      return;
    }

    close();
    current.action?.onDismiss?.();
  };

  const press = (onPress?: () => void) => {
    if (current === null) {
      return;
    }

    close();
    onPress?.();
  };

  return (
    <DialogContext.Provider value={dialog}>
      {children}
      <Modal
        visible={state.phase === 'open' || state.phase === 'closing'}
        transparent
        animationType='none'
        statusBarTranslucent
        navigationBarTranslucent
        onShow={() => send({type: 'shown'})}
        onDismiss={() => send({type: 'dismissed'})}
        onRequestClose={dismiss}
      >
        <View
          className='flex-1 items-center justify-center px-5'
          style={{
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <Pressable
            className='absolute inset-0'
            onPress={dismiss}
            accessible={false}
            importantForAccessibility='no'
          >
            <Animated.View
              className='flex-1 bg-theme-ink/30'
              style={{opacity: progress}}
            />
          </Pressable>
          {request ? (
            <Animated.View
              accessibilityViewIsModal
              onAccessibilityEscape={dismiss}
              style={{
                width: '100%',
                maxWidth: 340,
                maxHeight: '100%',
                opacity: progress,
                transform: reduceMotion
                  ? []
                  : [
                      {
                        scale: progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.95, 1],
                        }),
                      },
                    ],
              }}
            >
              <View className='shrink overflow-hidden rounded-2xl border border-theme-line bg-theme-surface'>
                <ScrollView bounces={false} contentContainerClassName='p-5'>
                  <View
                    ref={titleRef}
                    accessible
                    accessibilityRole='header'
                    accessibilityLabel={`${request.title}. ${request.message}`}
                    accessibilityHint={hintOf(request, t)}
                  >
                    <Text className='text-[17px] font-semibold tracking-tight text-theme-ink'>
                      {request.title}
                    </Text>
                    <Text className='mt-1.5 font-sans text-sm leading-5 text-theme-muted'>
                      {request.message}
                    </Text>
                  </View>
                  {request.times ? (
                    <View className='mt-4 gap-2'>
                      {request.times.map((time) => (
                        <View
                          key={`${time.caption}${time.when}`}
                          accessible
                          accessibilityLabel={spoken(time)}
                          className={`rounded-xl px-3.5 py-2.5 ${TONES[time.tone ?? 'none'].card}`}
                        >
                          <TimeLines time={time} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {request.choices ? (
                    <View className='mt-5 gap-2'>
                      {request.choicesLabel ? (
                        <Text className={`${CAPTION} text-theme-muted`}>
                          {request.choicesLabel}
                        </Text>
                      ) : null}
                      {request.choices.map((choice) => (
                        <Pressable
                          key={choice.label}
                          accessibilityRole='button'
                          accessibilityLabel={choice.label}
                          onPress={() => press(choice.onPress)}
                          className='min-h-12 flex-row items-center gap-3 rounded-xl border border-theme-edge bg-theme-surface px-4 py-2.5 active:bg-theme-danger/5'
                        >
                          <View className='min-w-0 flex-1'>
                            {choice.time ? (
                              <TimeLines time={choice.time} />
                            ) : (
                              <Text className='text-sm font-medium text-theme-ink'>
                                {choice.label}
                              </Text>
                            )}
                          </View>
                          <Icon
                            name='chevron-forward'
                            size={16}
                            color={theme.faint}
                          />
                        </Pressable>
                      ))}
                      <Pressable
                        accessibilityRole='button'
                        onPress={close}
                        className={`${SECONDARY} mt-2 w-full flex-none`}
                      >
                        <Text className={`${BUTTON_TEXT} text-theme-ink`}>
                          {t.common.cancel}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View className='mt-6 flex-row gap-2.5'>
                      {request.action ? (
                        <Pressable
                          accessibilityRole='button'
                          onPress={dismiss}
                          className={SECONDARY}
                        >
                          <Text className={`${BUTTON_TEXT} text-theme-ink`}>
                            {dismissLabel(request.action, t)}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole='button'
                        onPress={() => press(request.action?.onPress)}
                        className={`${BUTTON} bg-theme-ink`}
                      >
                        <Text className={`${BUTTON_TEXT} text-theme-surface`}>
                          {request.action?.label ?? t.common.ok}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}
