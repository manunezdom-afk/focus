import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Variant = 'card' | 'flat';

type Props = {
  children: ReactNode;
  // 'card' (default): borde + sombra + radius 18.
  // 'flat': sin borde ni sombra; útil si ya estás dentro de otra card y solo
  //         querés el wash de gradient (ej. account row).
  variant?: Variant;
  // Intensidad del gradient (0..1). Default 1. Subir si la base es muy oscura.
  intensity?: number;
  // Extra style merged sobre el contenedor exterior (sombra). NO sobre el inner.
  style?: ViewStyle;
  // Border radius (default 18 — coincide con summaryCard de EmptyDayState).
  radius?: number;
};

// Surface con glass-look + gradient brand violeta→azul→cyan.
// Es la unidad visual compartida entre Mi Día (EmptyDayState.summaryCard) y
// el resto de las pantallas — Calendar empty, Tasks summary/empty,
// Settings AccountCard. Mantenerla en un solo lugar evita drift entre
// pantallas y deja un knob central para futuros tweaks.
//
// El padding NO va acá; el caller lo controla con su propio estilo dentro.
// Esto hace que el componente sea drop-in en cualquier card existente sin
// pelearse con espacios verticales.
export function GeminiSurface({
  children,
  variant = 'card',
  intensity = 1,
  style,
  radius = 18,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';

  // Mismo gradient que EmptyDayState.summaryCard. Mantener idéntico para que
  // el ojo vea "es la misma identidad" entre pantallas.
  const gradientColors = isDark
    ? ([
        `rgba(139,92,246,${0.20 * intensity})`,
        `rgba(59,130,246,${0.08 * intensity})`,
        `rgba(34,211,238,${0.03 * intensity})`,
      ] as const)
    : ([
        `rgba(139,92,246,${0.10 * intensity})`,
        `rgba(59,130,246,${0.04 * intensity})`,
        `rgba(34,211,238,${0.01 * intensity})`,
      ] as const);

  // Glass base — translúcido para que el AmbientNova de fondo respire a
  // través del card. En light usamos blanco al 65%; en dark blanco al 4%.
  const glassBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)';

  if (variant === 'flat') {
    return (
      <View style={[styles.flatInner, { borderRadius: radius, backgroundColor: glassBg }, style]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
          pointerEvents="none"
        />
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.shadow,
        {
          borderRadius: radius,
          shadowColor: isDark ? '#a78bfa' : '#8b5cf6',
        },
        style,
      ]}
    >
      <View
        style={[
          styles.cardInner,
          {
            borderRadius: radius,
            backgroundColor: glassBg,
            borderColor: c.border,
          },
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 4,
  },
  cardInner: {
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  flatInner: {
    overflow: 'hidden',
  },
});
