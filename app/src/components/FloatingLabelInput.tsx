import Ionicons from '@expo/vector-icons/Ionicons';
import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {FieldProblem} from '@/components/FieldProblem';
import {useMessages} from '@/i18n/LocaleProvider';
import theme from '@/theme.json';

type FloatingLabelInputProps = TextInputProps & {
  label: string;
  // What is wrong with what is typed, said under the field.
  problem?: string | null;
};

// Where the text and the label start, as px-4 is on the other fields.
const INSET = 14;
// Room on the right for the button that shows a password.
const REVEAL_WIDTH = 44;

export function FloatingLabelInput({
  label,
  value,
  className,
  secureTextEntry,
  onFocus,
  onBlur,
  problem,
  ...props
}: FloatingLabelInputProps) {
  const t = useMessages();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // A password can be shown while it is typed, to check all of it.
  const [revealed, setRevealed] = useState(false);
  const floated = focused || Boolean(value);
  const [progress] = useState(() => new Animated.Value(Boolean(value) ? 1 : 0));
  const right = secureTextEntry ? REVEAL_WIDTH : INSET;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: floated ? 1 : 0,
      duration: 150,
      easing: Easing.bezier(0, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [floated, progress]);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      // VoiceOver reaches the field itself rather than a group around it.
      accessible={false}
      className={className}
    >
      <View
        className={`h-[52px] justify-end rounded-sm border bg-theme-surface pb-[5px] ${
          problem
            ? 'border-theme-danger'
            : focused
              ? 'border-theme-ink'
              : 'border-theme-edge'
        }`}
        style={{paddingLeft: INSET, paddingRight: right}}
      >
        <View style={{height: 24, justifyContent: 'center'}}>
          <TextInput
            {...props}
            ref={inputRef}
            value={value}
            secureTextEntry={secureTextEntry && !revealed}
            accessibilityLabel={label}
            accessibilityHint={problem ?? undefined}
            textAlignVertical='center'
            underlineColorAndroid='transparent'
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            style={{
              height: 24,
              minHeight: 24,
              maxHeight: 24,
              padding: 0,
              includeFontPadding: false,
              fontSize: 16,
              color: theme.ink,
              fontFamily: 'Merriweather_400Regular',
            }}
          />
        </View>
        <Animated.Text
          accessible={false}
          pointerEvents='none'
          // A long label is cut short rather than wrapped onto a second
          // line, where it would run into what is typed.
          numberOfLines={1}
          style={{
            position: 'absolute',
            left: INSET,
            right,
            fontFamily: 'Merriweather_500Medium',
            top: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [17, 7],
            }),
            fontSize: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [15, 13],
            }),
            lineHeight: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [17, 13],
            }),
            color: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.faint, theme.muted],
            }),
          }}
        >
          {label}
        </Animated.Text>
        {secureTextEntry ? (
          <Pressable
            onPress={() => setRevealed((previous) => !previous)}
            accessibilityRole='button'
            accessibilityLabel={
              revealed ? t.common.hidePassword : t.common.showPassword
            }
            className='absolute bottom-0 right-0 top-0 items-center justify-center active:opacity-60'
            style={{width: REVEAL_WIDTH}}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {problem ? <FieldProblem message={problem} /> : null}
    </Pressable>
  );
}
