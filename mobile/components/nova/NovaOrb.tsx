import { useEffect } from 'react';
import { View } from 'react-native';
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
  ambient?: boolean;
  breathing?: boolean;
  // Modo "escribiendo" — añade un pulso secundario más rápido sobre el breathing.
  // Activar cuando el usuario está ingresando texto o Nova está respondiendo.
  active?: boolean;
};

// Spot de color orbitando dentro del orbe. Usa trigonometría en worklet
// (Math.cos/sin disponibles en Reanimated 3 JSI) para mover la mancha
// en un círculo de radio `orbitR` centrado en el orbe.
function ColorSpot({
  size,
  color,
  orbitR,
  duration,
  reverse = false,
  initialAngle,
  opacity,
}: {
  size: number;
  color: string;
  orbitR: number;
  duration: number;
  reverse?: boolean;
  initialAngle: number;
  opacity: number;
}) {
  const angle = useSharedValue(initialAngle);

  useEffect(() => {
    angle.value = initialAngle;
    angle.value = withRepeat(
      withTiming(initialAngle + (reverse ? -360 : 360), {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, []);

  const spotSize = size * 0.62;

  const animStyle = useAnimatedStyle(() => {
    'worklet';
    const rad = (angle.value * Math.PI) / 180;
    return {
      transform: [
        { translateX: Math.cos(rad) * orbitR },
        { translateY: Math.sin(rad) * orbitR },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: spotSize,
          height: spotSize,
          borderRadius: spotSize / 2,
          backgroundColor: color,
          opacity,
        },
        animStyle,
      ]}
    />
  );
}

// Firma visual de Nova — orbe vivo con manchas de color orbitando.
// Simula un mesh-gradient animado sin librerías externas:
//   · Capa de sombra separada (no overflow:hidden) para que la sombra
//     se muestre correctamente en iOS.
//   · Capa de recorte (overflow:hidden) para que los spots no salgan del círculo.
//   · 3 spots (cyan, violeta, índigo claro) orbitando a velocidades distintas.
export function NovaOrb({ size = 64, ambient = true, breathing = false, active = false }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const dark = scheme === 'dark';

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!breathing) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [breathing, pulse]);

  // Pulso secundario más rápido cuando active (el usuario escribe / Nova responde).
  const activePulse = useSharedValue(0);
  useEffect(() => {
    if (active) {
      activePulse.value = withRepeat(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      activePulse.value = withTiming(0, { duration: 280 });
    }
  }, [active, activePulse]);

  const orbAnimStyle = useAnimatedStyle(() => {
    'worklet';
    const activeBoost = 1 + activePulse.value * 0.06;
    return { transform: [{ scale: pulse.value * activeBoost }] };
  });
  const haloAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 2 - pulse.value + 0.05 }],
  }));

  const haloDiameter = size * 1.7;
  const orbitR = size * 0.2;

  // Colores de los spots por modo
  const spotCyan = dark ? '#22d3ee' : '#38bdf8';
  const spotViolet = dark ? '#c084fc' : '#a78bfa';
  const spotIndigo = dark ? '#818cf8' : '#93c5fd';

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Halo ambiente */}
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
              opacity: dark ? 0.45 : 0.55,
            },
            haloAnimStyle,
          ]}
        />
      ) : null}

      {/* Capa de sombra — separada para que overflow:hidden no la corte */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.primary,
            shadowColor: c.primary,
            shadowOffset: { width: 0, height: size * 0.18 },
            shadowOpacity: 0.48,
            shadowRadius: size * 0.42,
            elevation: 6,
          },
          orbAnimStyle,
        ]}
      />

      {/* Orbe con recorte — spots de color confinados al círculo */}
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: c.primary,
            alignItems: 'center',
            justifyContent: 'center',
          },
          orbAnimStyle,
        ]}
      >
        {/* Spot 1 — cyan, gira en sentido horario */}
        <ColorSpot
          size={size}
          color={spotCyan}
          orbitR={orbitR}
          duration={3400}
          initialAngle={0}
          opacity={0.7}
        />
        {/* Spot 2 — violeta, gira en sentido antihorario */}
        <ColorSpot
          size={size}
          color={spotViolet}
          orbitR={orbitR * 1.1}
          duration={4800}
          reverse
          initialAngle={120}
          opacity={0.6}
        />
        {/* Spot 3 — índigo claro, radio pequeño más centrado */}
        <ColorSpot
          size={size}
          color={spotIndigo}
          orbitR={orbitR * 0.65}
          duration={2600}
          initialAngle={240}
          opacity={0.5}
        />

        {/* Reflejo superior izquierdo */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.1,
            left: size * 0.14,
            width: size * 0.3,
            height: size * 0.3,
            borderRadius: size * 0.15,
            backgroundColor: 'rgba(255,255,255,0.26)',
          }}
        />
        {/* Punto brillante central */}
        <View
          pointerEvents="none"
          style={{
            width: size * 0.13,
            height: size * 0.13,
            borderRadius: size * 0.065,
            backgroundColor: 'rgba(255,255,255,0.72)',
          }}
        />
      </Animated.View>
    </View>
  );
}
