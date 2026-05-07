import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem } from '@/src/data/types';

type Props = {
  event: EventItem;
  isPast: boolean;
  // Llamado al tocar el ícono papelera. El padre maneja la confirmación.
  onDeletePress?: () => void;
};

// Extrae solo la hora de inicio de "HH:MM" o "HH:MM - HH:MM".
function startTimeStr(time: string): string {
  if (!time) return '';
  return time.split('-')[0].trim();
}

const DOT_SIZE = 8;
const COL_GAP = 20;

export function TimelineEventBlock({ event, isPast, onDeletePress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const timeLabel = startTimeStr(event.time) || '—';

  // Ignorar descriptions que parecen fechas ISO (artefacto legacy).
  const hasDescription =
    !!event.description &&
    !/^\d{4}-\d{2}-\d{2}$/.test(event.description.trim());

  return (
    <View style={styles.row}>
      {/* Columna hora — 52px fija, texto alineado a la derecha */}
      <View style={styles.timeCol}>
        <Text style={[styles.timeText, { color: c.textMuted }]}>{timeLabel}</Text>
      </View>

      {/* Columna tarjeta — flex 1, contiene dot absoluto + card */}
      <View style={styles.cardCol}>
        {/* Dot conector centrado en el gap */}
        <View style={[styles.dot, { backgroundColor: c.primary }]} />

        {/* Card con acento lateral primary */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              borderLeftColor: c.primary,
              opacity: isPast ? 0.55 : 1,
            },
          ]}
        >
          {/* Fila superior: título + botón papelera */}
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            {onDeletePress ? (
              <Pressable
                onPress={onDeletePress}
                hitSlop={8}
                style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.5 : 1 }]}
                accessibilityLabel="Eliminar evento"
                accessibilityRole="button"
              >
                <IconSymbol name="trash.fill" size={14} color={c.textSubtle} />
              </Pressable>
            ) : null}
          </View>

          {hasDescription ? (
            <Text style={[styles.description, { color: c.textMuted }]} numberOfLines={2}>
              {event.description}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    columnGap: COL_GAP,
    paddingHorizontal: Spacing.lg,
  },
  timeCol: {
    width: 52,
    flexShrink: 0,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  timeText: {
    ...Typography.caption,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  cardCol: {
    flex: 1,
    paddingBottom: Spacing['3xl'],
  },
  // Dot posicionado centrado en el gap (left: -(gap/2 + dot/2))
  dot: {
    position: 'absolute',
    left: -(COL_GAP / 2 + DOT_SIZE / 2),
    top: 16,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    zIndex: 1,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.bodyStrong,
    flex: 1,
  },
  deleteBtn: {
    // hitSlop amplía el área táctil; el ícono visual es 14px
    paddingTop: 2,
  },
  description: {
    ...Typography.caption,
  },
});
