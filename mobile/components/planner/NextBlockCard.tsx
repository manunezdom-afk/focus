import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem } from '@/src/data/types';

type Props = {
  events: EventItem[];
};

// "HH:MM" o "HH:MM - HH:MM" → { startH, endH }
function timeRange(time: string): { startH: number; endH: number | null } | null {
  if (!time) return null;
  const m = String(time).match(/^(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const startH = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  const endH = m[3] ? parseInt(m[3], 10) + parseInt(m[4], 10) / 60 : null;
  return { startH, endH };
}

function fmtMinutes(min: number): string {
  const m = Math.max(0, min);
  if (m < 1) return 'ahora';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return mm > 0 ? `${h}h ${mm}m` : `${h}h`;
}

export function NextBlockCard({ events }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;

  const timed = events
    .map((e) => ({ event: e, range: timeRange(e.time) }))
    .filter(
      (x): x is { event: EventItem; range: { startH: number; endH: number | null } } =>
        x.range !== null,
    )
    .sort((a, b) => a.range.startH - b.range.startH);

  // Sin eventos con hora → no renderizamos la card.
  if (timed.length === 0) return null;

  // Activo: ahora dentro de [start, end). Sin endH usamos ventana 15min.
  const active =
    timed.find((x) => {
      const { startH, endH } = x.range;
      if (endH !== null && endH > startH) return nowH >= startH && nowH < endH;
      return nowH >= startH && nowH < startH + 15 / 60;
    }) ?? null;

  const next = !active ? timed.find((x) => x.range.startH > nowH) ?? null : null;

  let label = 'Próximo bloque';
  let badge: string | null = null;
  let metric: string | null = null;
  let metricSuffix: string | null = null;
  let titleText: string | null = null;
  let timeText: string | null = null;

  if (active) {
    label = 'En curso';
    badge = 'ACTIVO';
    titleText = active.event.title;
    timeText = active.event.time;
    if (active.range.endH !== null && active.range.endH > active.range.startH) {
      const elapsed = (nowH - active.range.startH) * 60;
      const total = (active.range.endH - active.range.startH) * 60;
      metric = String(Math.round(elapsed));
      metricSuffix = `min transcurridos · de ${Math.round(total)} min`;
    } else {
      metricSuffix = 'En curso';
    }
  } else if (next) {
    titleText = next.event.title;
    timeText = next.event.time;
    const mins = (next.range.startH - nowH) * 60;
    metric = fmtMinutes(mins);
    metricSuffix = mins >= 1 ? 'para empezar' : null;
  } else {
    // Todos los bloques con hora ya pasaron.
    metricSuffix = 'Sin bloques pendientes hoy.';
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(360).duration(400)}
      style={[
        styles.wrap,
        {
          // Tinte sutil indigo cuando hay actividad activa; surface plano
          // si no quedan bloques pendientes. Da jerarquía visual sin ser
          // ruidoso.
          backgroundColor: active || next ? c.surfaceTint : c.surface,
          borderColor: c.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: c.text }]}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: c.primaryContainer }]}>
            <Text style={[styles.badgeText, { color: c.primary }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      {timeText ? (
        <Text style={[styles.timeText, { color: c.textMuted }]}>{timeText}</Text>
      ) : null}

      {titleText ? (
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {titleText}
        </Text>
      ) : null}

      <View style={styles.metricRow}>
        {metric ? (
          <Text style={[styles.metric, { color: c.primary }]}>{metric}</Text>
        ) : null}
        {metricSuffix ? (
          <Text style={[styles.metricSuffix, { color: c.textMuted }]}>{metricSuffix}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Card hero — más rounded y con shadow indigo sutil para sentirse
  // como elemento "vivo" del día, distinto de los bloques regulares.
  wrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: Spacing.lg,
    gap: 6,
    shadowColor: '#5b5ef5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...Typography.title3,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  badgeText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  timeText: {
    ...Typography.caption,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  metric: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metricSuffix: {
    ...Typography.caption,
    fontWeight: '500',
  },
});
