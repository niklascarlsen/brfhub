import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import theme from '@/theme.json';

type FloatingLabelInputProps = TextInputProps & {
  label: string;
};

export function FloatingLabelInput({
  label,
  value,
  className,
  onFocus,
  onBlur,
  ...props
}: FloatingLabelInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const floated = focused || Boolean(value);
  const [progress] = useState(() => new Animated.Value(Boolean(value) ? 1 : 0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: floated ? 1 : 0,
      duration: 150,
      easing: Easing.bezier(0, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [floated, progress]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} className={className}>
      <View
        className={`h-[52px] justify-end rounded-sm border bg-theme-surface px-4 pb-2 ${
          focused ? 'border-theme-ink' : 'border-theme-edge'
        }`}
      >
        <View style={{height: 24, justifyContent: 'center'}}>
          <TextInput
            {...props}
            ref={inputRef}
            value={value}
            accessibilityLabel={label}
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
              paddingVertical: 0,
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
          style={{
            position: 'absolute',
            left: 16,
            fontFamily: 'Merriweather_500Medium',
            top: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [18, 8],
            }),
            fontSize: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 13],
            }),
            lineHeight: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 13],
            }),
            color: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [theme.faint, theme.muted],
            }),
          }}
        >
          {label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}
