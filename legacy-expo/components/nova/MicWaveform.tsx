import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

// Visualizador de barras estilo ChatGPT/Siri Voice Mode.
// Recibe `level` 0..1 desde el hook de dictado (volumen normalizado del
// micrófono iOS Speech). Cada barra escala su altura con una pequeña
// variación pseudo-aleatoria para que no se sientan robóticas.
type Props = {
  level: number; // 0..1
  active: boolean; // si false, las barras quedan en reposo
  color?: string;
};

const BARS = 4;
const HEIGHTS_AT_REST = [4, 6, 5, 4]; // px — pequeño "respiro" cuando no hay sonido
const MIN_H = 4;
const MAX_H = 20;

// Pesos por barra para que la del centro responda más fuerte → curva
// orgánica en lugar de un wall plano de 4 barras iguales.
const BAR_WEIGHT = [0.7, 1.0, 0.95, 0.65];

export function MicWaveform({ level, active, color = '#fff' }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: BARS }).map((_, i) => (
        <Bar key={i} index={i} level={level} active={active} color={color} />
      ))}
    </View>
  );
}

function Bar({
  index,
  level,
  active,
  color,
}: {
  index: number;
  level: number;
  active: boolean;
  color: string;
}) {
  const height = useSharedValue(HEIGHTS_AT_REST[index] ?? MIN_H);

  useEffect(() => {
    if (!active) {
      height.value = withTiming(HEIGHTS_AT_REST[index] ?? MIN_H, { duration: 180 });
      return;
    }
    const weighted = level * (BAR_WEIGHT[index] ?? 1);
    const target = MIN_H + weighted * (MAX_H - MIN_H);
    // 70ms ≈ matchea el intervalMillis de volumechange (80ms) → animación
    // que no queda atrás del próximo frame de audio.
    height.value = withTiming(target, { duration: 70 });
  }, [level, active, index, height]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: MAX_H,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
  },
});
