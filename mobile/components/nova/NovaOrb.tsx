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
  // Respiración infinita 1↔1.05 cada 1.6s. Default false para no
  // gastar UI thread con animaciones invisibles. Activar SOLO en orbs
  // grandes hero (size >= 80) que el usuario está mirando directamente.
  breathing?: boolean;
};

// Firma visual de Nova en mobile. Adaptación del NovaOrb legacy
// (radial-gradient + breathing) sin requerir gradient lib: orb sólido
// indigo + highlight superior izquierdo simulando reflejo + halo
// ambient opcional.
//
// Performance: la respiración (`withRepeat` infinito) corre en UI thread
// pero igual consume worklet cycles. Default off para que en headers
// compactos (Tasks summary, Nova header) sea estática. Solo los hero
// orbs grandes (Nova empty 88px, Tasks empty 84px) la activan.
export function NovaOrb({ size = 64, ambient = true, breathing = false }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!breathing) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.05, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [breathing, pulse]);

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
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
