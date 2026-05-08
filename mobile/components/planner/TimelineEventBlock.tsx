import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { detectEventKind, getBlockColors } from '@/src/data/blockColors';
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
  // Índice para stagger en la entrada animada. El padre lo pasa.
  enterIndex?: number;
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
  enterIndex = 0,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const timeLabel = startTimeStr(event.time) || '—';

  // Stagger 50ms por bloque, máx 240ms para que el último no tarde demasiado.
  const enterDelay = Math.min(160 + enterIndex * 50, 400);

  // Ignorar descriptions que parecen fechas ISO (artefacto legacy).
  const hasDescription =
    !!event.description &&
    !/^\d{4}-\d{2}-\d{2}$/.test(event.description.trim());

  // El evento se ve "apagado" si está hecho o ya pasó.
  const dim = done || isPast;

  // Color por tipo de bloque: evento azul, recordatorio ámbar, focus cyan.
  // Cuando está hecho, ganamos el verde de éxito por encima de la categoría.
  const kind = detectEventKind({ title: event.title, section: event.section });
  const kindColors = getBlockColors(kind, scheme);
  const dotColor = done ? c.success : kindColors.accent;
  const accentColor = done ? c.success : kindColors.accent;

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(320)}
      style={styles.row}
    >
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
          {/* Chip de categoría — distingue evento / recordatorio / enfocado */}
          <View style={styles.kindRow}>
            <View
              style={[
                styles.kindChip,
                { backgroundColor: kindColors.badge },
              ]}
            >
              <Text style={[styles.kindChipText, { color: kindColors.badgeText }]}>
                {kindColors.label}
              </Text>
            </View>
          </View>

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
    </Animated.View>
  );
}

// Nota: NO envolver con React.memo manualmente. Expo SDK 54 tiene
// `reactCompiler: true` (app.json), que transforma cada función-componente a
// su forma optimizada con cache interno. Wrapping manual con memo() devuelve
// un objeto que React Fabric no sabe llamar — crash:
// "Component is not a function (it is Object)" al renderizar Mi Día.
// El compilador ya hace memoización; confiar en él.

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
  // Card suave estilo IA moderna: borderRadius más amplio, acento
  // lateral más fino (3 en vez de 4), shadow muy sutil para anclar
  // visualmente sin ruido.
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    borderRadius: 16,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  kindRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  kindChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
