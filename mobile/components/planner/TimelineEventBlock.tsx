import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem } from '@/src/data/types';

type Props = {
  event: EventItem;
  isPast: boolean;
  // Estado "done" local (legacy lo persiste en localStorage; mobile lo guarda
  // en memoria del padre). Se pierde al cambiar de tab — coherente con un
  // "checkpoint visual" que aún no tiene schema persistido.
  done: boolean;
  onToggleDone?: () => void;
  onDeletePress?: () => void;
};

function startTimeStr(time: string): string {
  if (!time) return '';
  return time.split('-')[0].trim();
}

const DOT_SIZE = 8;
const COL_GAP = 20;

export function TimelineEventBlock({
  event,
  isPast,
  done,
  onToggleDone,
  onDeletePress,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const timeLabel = startTimeStr(event.time) || '—';

  // Ignorar descriptions que parecen fechas ISO (artefacto legacy).
  const hasDescription =
    !!event.description &&
    !/^\d{4}-\d{2}-\d{2}$/.test(event.description.trim());

  // El evento se ve "apagado" si está hecho o ya pasó.
  const dim = done || isPast;

  // Color del dot — verde si hecho, primary si futuro/activo.
  const dotColor = done ? c.success : c.primary;
  const accentColor = done ? c.success : c.primary;

  return (
    <View style={styles.row}>
      {/* Columna hora — 52px fija, texto alineado a la derecha */}
      <View style={styles.timeCol}>
        <Text style={[styles.timeText, { color: c.textMuted }]}>{timeLabel}</Text>
      </View>

      {/* Columna tarjeta — flex 1, contiene dot absoluto + card */}
      <View style={styles.cardCol}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              borderLeftColor: accentColor,
              opacity: dim ? 0.55 : 1,
            },
          ]}
        >
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                {
                  color: c.text,
                  textDecorationLine: done ? 'line-through' : 'none',
                },
              ]}
              numberOfLines={2}
            >
              {event.title}
            </Text>

            <View style={styles.actionsCol}>
              {onToggleDone ? (
                <Pressable
                  onPress={onToggleDone}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.doneBtn,
                    {
                      backgroundColor: done
                        ? c.surfaceMuted
                        : c.primaryContainer,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                  accessibilityLabel={done ? 'Desmarcar evento' : 'Marcar evento hecho'}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.doneBtnText,
                      { color: done ? c.success : c.primary },
                    ]}
                  >
                    {done ? '✓ HECHO' : 'HECHO ✓'}
                  </Text>
                </Pressable>
              ) : null}

              {onDeletePress ? (
                <Pressable
                  onPress={onDeletePress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  accessibilityLabel="Eliminar evento"
                  accessibilityRole="button"
                >
                  <IconSymbol name="trash.fill" size={14} color={c.textSubtle} />
                </Pressable>
              ) : null}
            </View>
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
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  doneBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  doneBtnText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  deleteBtn: {
    paddingTop: 2,
  },
  description: {
    ...Typography.caption,
  },
});
