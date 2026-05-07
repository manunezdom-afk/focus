import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  // Próximo evento — si null, no se renderiza nada.
  title: string;
  startTime: string; // "HH:MM"
  countdown: { hours: number; minutes: number } | null;
};

// "Próximo Bloque" — réplica del card derecho del legacy Mi Día. En mobile
// va inline (full-width) bajo el header. Si no hay evento futuro hoy,
// el caller debe omitir el componente.
//
// Visual:
//   • Icono reloj + título "Próximo Bloque"
//   • Hora grande (15:00) + título evento
//   • Countdown grande "5h 7m para empezar"
export function NextBlockCard({ title, startTime, countdown }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function formatCountdown(): string | null {
    if (!countdown) return null;
    const { hours, minutes } = countdown;
    if (hours === 0 && minutes === 0) return 'empieza ahora';
    if (hours === 0) return `${minutes}m para empezar`;
    if (minutes === 0) return `${hours}h para empezar`;
    return `${hours}h ${minutes}m para empezar`;
  }

  const countdownStr = formatCountdown();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surfaceTint, borderColor: c.border },
      ]}
    >
      <View style={styles.header}>
        <IconSymbol name="calendar" size={16} color={c.primary} />
        <Text style={[styles.headerLabel, { color: c.primary }]}>
          Próximo bloque
        </Text>
      </View>

      <Text style={[styles.startTime, { color: c.textMuted }]}>{startTime}</Text>
      <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
        {title}
      </Text>

      {countdownStr ? (
        <Text style={[styles.countdown, { color: c.primary }]}>{countdownStr}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  startTime: {
    ...Typography.caption,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  title: {
    ...Typography.title3,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  countdown: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
});
