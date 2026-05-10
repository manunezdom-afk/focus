import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Paleta Nova: gradiente azul puro (cyan brillante → cobalto profundo).
// Aislada de Colors.primary para que el orbe luzca su identidad azul propia
// independientemente del primary indigo de la marca usado en botones/UI.
const NOVA_PALETTE = {
  light: {
    base: '#2563eb',     // royal blue 600 — superficie del orbe
    shadow: '#1d4ed8',   // cobalt blue 700 — sombra
    halo: '#dbeafe',     // blue 100 — anillo ambiente
    spotCyan: '#22d3ee', // cyan 400 — highlight cálido
    spotMid: '#3b82f6',  // blue 500 — punto intermedio
    spotDeep: '#1e40af', // blue 800 — profundo
  },
  dark: {
    base: '#3b82f6',     // blue 500 — más luminoso sobre fondo oscuro
    shadow: '#2563eb',   // royal
    halo: '#1e3a8a',     // blue 900
    spotCyan: '#67e8f9', // cyan 300
    spotMid: '#60a5fa',  // blue 400
    spotDeep: '#1d4ed8', // blue 700
  },
};

type Props = {
  size?: number;
  ambient?: boolean;
  breathing?: boolean;
  // Modo "escribiendo" — añade un pulso secundario más rápido sobre el breathing.
  // Activar cuando el usuario está ingresando texto o Nova está respondiendo.
  active?: boolean;
  // Pausa todos los worklets (rotación de ColorSpots + pulse + activePulse).
  // Padre lo activa cuando la pantalla pierde foco (vía useIsFocused) para
  // no quemar UI thread cuando el orbe ni siquiera es visible. Sin esto,
  // las animaciones de NovaOrb seguían corriendo desde el primer mount —
  // 60fps × 3 spots con cos/sin trig + 2 pulses adicionales.
  paused?: boolean;
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
  paused,
}: {
  size: number;
  color: string;
  orbitR: number;
  duration: number;
  reverse?: boolean;
  initialAngle: number;
  opacity: number;
  paused: boolean;
}) {
  const angle = useSharedValue(initialAngle);

  useEffect(() => {
    if (paused) {
      // Cancela el withRepeat en vuelo y deja al spot quieto en su ángulo
      // actual. No lo "rebobinamos" a initialAngle porque visualmente sería
      // un salto — preferimos congelar donde estaba.
      cancelAnimation(angle);
      return;
    }
    angle.value = withRepeat(
      withTiming(angle.value + (reverse ? -360 : 360), {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(angle);
  }, [paused, duration, reverse, angle]);

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
export function NovaOrb({
  size = 64,
  ambient = true,
  breathing = false,
  active = false,
  paused = false,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const dark = scheme === 'dark';
  const p = NOVA_PALETTE[dark ? 'dark' : 'light'];

  // Cuando paused=true (ej. NovaScreen perdió foco), forzamos breathing y
  // active a false sin tocar el padre — el padre puede seguir pasando los
  // valores originales sin enterarse. Así, todos los withRepeat caen en
  // los caminos "no animar" de los effects siguientes.
  const breathingActive = breathing && !paused;
  const motionActive = active && !paused;

  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!breathingActive) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [breathingActive, pulse]);

  // Pulso secundario más rápido cuando active (el usuario escribe / Nova responde).
  const activePulse = useSharedValue(0);
  useEffect(() => {
    if (motionActive) {
      activePulse.value = withRepeat(
        withTiming(1, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(activePulse);
      activePulse.value = withTiming(0, { duration: 280 });
    }
    return () => cancelAnimation(activePulse);
  }, [motionActive, activePulse]);

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

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Halo ambiente — tinte azul cobalto suave */}
      {ambient ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              width: haloDiameter,
              height: haloDiameter,
              borderRadius: haloDiameter / 2,
              backgroundColor: p.halo,
              opacity: dark ? 0.5 : 0.6,
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
            backgroundColor: p.base,
            shadowColor: p.shadow,
            shadowOffset: { width: 0, height: size * 0.18 },
            shadowOpacity: 0.5,
            shadowRadius: size * 0.42,
            elevation: 6,
          },
          orbAnimStyle,
        ]}
      />

      {/* Orbe con recorte — spots de azul confinados al círculo */}
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: p.base,
            alignItems: 'center',
            justifyContent: 'center',
          },
          orbAnimStyle,
        ]}
      >
        {/* Spot 1 — cyan brillante, gira en sentido horario */}
        <ColorSpot
          size={size}
          color={p.spotCyan}
          orbitR={orbitR}
          duration={3400}
          initialAngle={0}
          opacity={0.7}
          paused={paused}
        />
        {/* Spot 2 — azul medio, gira en sentido antihorario */}
        <ColorSpot
          size={size}
          color={p.spotMid}
          orbitR={orbitR * 1.1}
          duration={4800}
          reverse
          initialAngle={120}
          opacity={0.6}
          paused={paused}
        />
        {/* Spot 3 — cobalto profundo, radio pequeño más centrado */}
        <ColorSpot
          size={size}
          color={p.spotDeep}
          orbitR={orbitR * 0.65}
          duration={2600}
          initialAngle={240}
          opacity={0.5}
          paused={paused}
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
