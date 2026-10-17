import {LinearGradient} from 'expo-linear-gradient';
import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';

import {theme} from '@/theme';

const FADE = [theme['fade-veil'], theme['fade-clear']] as const;

// Fades the booking page into the background under its fixed resource and
// date pickers, so what scrolls up passes under softly. Shallow enough that
// nothing on the page at rest is faded. The web does this with a sticky div.
export function TopFade({children}: {children: ReactNode}) {
  return (
    <View className='flex-1'>
      {children}
      <LinearGradient pointerEvents='none' colors={FADE} style={styles.fade} />
    </View>
  );
}

// A third-party view, which NativeWind's className does not reach.
const styles = StyleSheet.create({
  fade: {position: 'absolute', top: 0, right: 0, left: 0, height: 8},
});
