import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { AmbientLevel } from '@/src/data/todayContext';

type Props = {
  scheme: 'light' | 'dark';
  level?: AmbientLevel;
};

// Modulación psicológica del pulso según señal del backend:
//   low    → respiración lenta (5500ms in/out, opacidad max 0.55)
//   medium → ritmo constante (2000ms, opacidad max 0.75)
//   high   → estroboscópico suave (500ms, opacidad max 1.0)
const PULSE = {
  low: { duration: 5500, max: 0.55 },
  medium: { duration: 2000, max: 0.75 },
  high: { duration: 500, max: 1.0 },
} as const;

export function AmbientNova({ scheme, level = 'low' }: Props) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(opacity);
    const cfg = PULSE[level];
    opacity.value = withTiming(1, { duration: 0 });
    opacity.value = withRepeat(
      withTiming(cfg.max, { duration: cfg.duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [level, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // Paleta cambia ligeramente con el nivel: low/medium = violeta-azul,
  // high = añade rojo cálido para señalar urgencia (sin gritar).
  const colors = (() => {
    if (level === 'high') {
      return scheme === 'dark'
        ? (['rgba(244,63,94,0.22)', 'rgba(139,92,246,0.10)', 'rgba(139,92,246,0)'] as const)
        : (['rgba(244,63,94,0.14)', 'rgba(139,92,246,0.06)', 'rgba(139,92,246,0)'] as const);
    }
    return scheme === 'dark'
      ? (['rgba(139,92,246,0.18)', 'rgba(59,130,246,0.06)', 'rgba(139,92,246,0)'] as const)
      : (['rgba(139,92,246,0.10)', 'rgba(59,130,246,0.04)', 'rgba(139,92,246,0)'] as const);
  })();

  return (
    <Animated.View style={[styles.layer, animStyle]} pointerEvents="none">
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
});
