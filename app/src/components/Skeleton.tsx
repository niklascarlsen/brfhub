import {useEffect, useState, type ReactNode} from 'react';
import {Animated, View} from 'react-native';

import {useMessages} from '@/i18n/LocaleProvider';

const PULSE_MS = 700;
const DIMMED_OPACITY = 0.45;

export function Skeleton({children}: {children: ReactNode}) {
  const t = useMessages();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: DIMMED_OPACITY,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();

    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{opacity}}
      accessible
      accessibilityLabel={t.common.loading}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility='no-hide-descendants'
      >
        {children}
      </View>
    </Animated.View>
  );
}

export function SkeletonBar({className}: {className: string}) {
  return <View className={`rounded-full bg-theme-line ${className}`} />;
}
