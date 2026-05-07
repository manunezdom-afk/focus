import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  size?: number;
  // Halo ambiente (anillo tinted exterior). false en headers compactos.
  ambient?: boolean;
};

// Firma visual de Nova en mobile. Adaptación del NovaOrb legacy
// (radial-gradient + breathing) sin requerir gradient lib: orb sólido
// indigo + highlight superior izquierdo simulando reflejo + halo
// animado opcional. Respiración suave 1↔1.06 cada 1.6s, mismo
// patrón que el legacy (3.2s legacy, acortado en mobile para que se
// note en una sesión corta).
export function NovaOrb({ size = 64, ambient = true }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.05, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  // Halo respira en contrafase para sentirse más vivo.
  const haloAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 2 - pulse.value + 0.05 }],
  }));

  const haloDiameter = size * 1.7;
  const highlightSize = size * 0.36;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ambient ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: haloDiameter,
              height: haloDiameter,
              borderRadius: haloDiameter / 2,
              backgroundColor: c.primaryContainer,
              opacity: scheme === 'dark' ? 0.45 : 0.55,
            },
            haloAnimStyle,
          ]}
        />
      ) : null}

      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.primary,
            shadowColor: c.primary,
            shadowOffset: { width: 0, height: size * 0.18 },
            shadowOpacity: 0.42,
            shadowRadius: size * 0.36,
            elevation: 6,
          },
          orbAnimStyle,
        ]}
      >
        {/* Highlight superior izquierdo — simula reflejo radial sin gradient lib */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.14,
            left: size * 0.18,
            width: highlightSize,
            height: highlightSize,
            borderRadius: highlightSize / 2,
            backgroundColor: 'rgba(255,255,255,0.32)',
          }}
        />
        {/* Punto interior brillante — pequeño foco al centro */}
        <View
          pointerEvents="none"
          style={{
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: (size * 0.16) / 2,
            backgroundColor: 'rgba(255,255,255,0.65)',
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
