import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import {BlurView} from 'expo-blur';
import {GlassView, isGlassEffectAPIAvailable} from 'expo-glass-effect';
import {LinearGradient} from 'expo-linear-gradient';
import {useContext, useEffect, useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View} from 'react-native';
import {useKeyboardState} from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {useMessages} from '@/i18n/LocaleProvider';
import {TAB_ICON_GLYPH} from '@/navigation/tabOptions';
import {theme} from '@/theme';

// The bar's padding around the tabs, p-1.5 below, which the lens is inset
// by too.
const PADDING = 6;
// The page fading into its background behind the bar, from its top edge
// down, so what scrolls under is not read sharp through the glass.
const FADE = [
  theme['fade-clear'],
  theme['fade-mid'],
  theme['fade-deep'],
] as const;
// The gap below the bar, the same as the pages' side padding (px-5 below)
// so the bar lines up with the cards and sits evenly in the corners. The
// home indicator and Android's gesture bar draw over it; Android's three
// buttons, taller, are cleared instead.
const GAP = 20;
const GESTURE_BAR_MAX = 32;

function liftFor(inset: number): number {
  return Platform.OS === 'android' && inset > GESTURE_BAR_MAX ? inset + 8 : GAP;
}

// Liquid Glass where iOS has it, the system's frosted material on older
// iOS, and on Android a plain surface, as its blur needs the whole screen
// wrapped as the blur target.
const LIQUID_GLASS = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

function Backdrop() {
  if (LIQUID_GLASS) {
    return (
      <GlassView
        glassEffectStyle='regular'
        tintColor={theme['bar-veil']}
        colorScheme='light'
        style={StyleSheet.absoluteFill}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        tint='systemChromeMaterialLight'
        intensity={80}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return <View className='absolute inset-0 bg-theme-bar-surface' />;
}

// The air at the end of a page.
const PAGE_END = 32;

// What a page scrolling under the floating bar pads its end with: the bar,
// its lift off the bottom edge and some air. Outside the tab navigator,
// where there is no bar, the air alone.
export function usePageEnd(): number {
  return PAGE_END + (useContext(BottomTabBarHeightContext) ?? 0);
}

// Floats over the page in a glass pill, the active tab marked by a lens
// that slides between them. The web's TabBar draws the same.
export function TabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const t = useMessages();
  const onHeight = useContext(BottomTabBarHeightCallbackContext);
  const keyboardShown = useKeyboardState((keyboard) => keyboard.isVisible);
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);

  const count = state.routes.length;
  const slot = width > 0 ? (width - PADDING * 2) / count : 0;

  useEffect(() => {
    const to = state.index * slot;
    // A spring damped to pass the tab it lands on only slightly.
    offset.value = reduceMotion
      ? to
      : withSpring(to, {damping: 22, stiffness: 220, mass: 0.8});
  }, [state.index, slot, offset, reduceMotion]);

  const lens = useAnimatedStyle(() => ({
    transform: [{translateX: offset.value}],
  }));

  // The keyboard toolbar sits right on the keyboard, not a bar above it.
  if (keyboardShown) {
    return null;
  }

  return (
    <View
      pointerEvents='box-none'
      onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
      style={{paddingBottom: liftFor(insets.bottom)}}
      className='absolute inset-x-0 bottom-0 px-5'
    >
      <LinearGradient
        pointerEvents='none'
        colors={FADE}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={styles.edge}
        className='w-full max-w-md self-center rounded-card'
      >
        <View
          accessibilityRole='tablist'
          accessibilityLabel={t.tabs.mainMenu}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          className='flex-row overflow-hidden rounded-card p-1.5'
        >
          <Backdrop />
          {slot > 0 ? (
            <Animated.View
              style={[{width: slot}, lens]}
              className='absolute bottom-1.5 left-1.5 top-1.5 rounded-card-inner bg-theme-sunk'
            />
          ) : null}
          {state.routes.map((route, index) => {
            const {options} = descriptors[route.key];
            const focused = index === state.index;
            // Every tab in ink: the lens alone tells the active one.
            const color = theme.ink;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole='tab'
                accessibilityState={{selected: focused}}
                onPress={onPress}
                className='flex-1 items-center gap-1 rounded-card-inner py-1.5 active:opacity-60'
              >
                {options.tabBarIcon?.({focused, color, size: TAB_ICON_GLYPH})}
                <Text
                  style={{color}}
                  className='mt-px text-[11px] font-semibold leading-[13px]'
                >
                  {options.title ?? route.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The bar's outline and its shadow on the page, which set it apart from
  // a white card passing under it.
  edge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme['bar-line'],
    // Android draws an elevation's shadow at its own strength and only takes
    // the hue, so it gets the ink whole.
    shadowColor: Platform.OS === 'android' ? theme.ink : theme['bar-shadow'],
    shadowOpacity: 1,
    // Half the web's 24px blur, as iOS measures it.
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
});
