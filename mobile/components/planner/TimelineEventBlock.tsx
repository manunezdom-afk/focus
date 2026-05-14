import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { detectEventKind, getBlockColors } from '@/src/data/blockColors';
import type { EventItem } from '@/src/data/types';

type Props = {
  event: EventItem;
  isPast: boolean;
  done: boolean;
  onToggleDone?: () => void;
  onDeletePress?: () => void;
  // Swipe-to-delete: borra sin Alert (la intención del gesto ya es suficiente).
  onSwipeDelete?: () => void;
  enterIndex?: number;
};

function startTimeStr(time: string): string {
  if (!time) return '';
  return time.split('-')[0].trim();
}

function splitDescription(description: string) {
  const lines = description
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const reminders: string[] = [];
  const body: string[] = [];
  for (const line of lines) {
    const match = line.match(/^Recordatorio:\s*(.+)$/i);
    if (match?.[1]) reminders.push(match[1].trim());
    else body.push(line);
  }
  return { body: body.join('\n'), reminders };
}

const DOT_SIZE = 8;
const COL_GAP = 20;
const DELETE_WIDTH = 80;

export function TimelineEventBlock({
  event,
  isPast,
  done,
  onToggleDone,
  onDeletePress,
  onSwipeDelete,
  enterIndex = 0,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const timeLabel = startTimeStr(event.time) || '—';

  const descriptionParts = splitDescription(event.description ?? '');
  const hasDescription =
    !!descriptionParts.body &&
    !/^\d{4}-\d{2}-\d{2}$/.test(descriptionParts.body.trim());

  const dim = done || isPast;

  const kind = detectEventKind({ title: event.title, section: event.section, icon: event.icon });
  const kindColors = getBlockColors(kind, scheme);
  const dotColor = done ? c.success : kindColors.accent;
  const accentColor = done ? c.success : kindColors.accent;

  const renderRightActions = () => (
    <Pressable
      onPress={onSwipeDelete ?? onDeletePress}
      style={({ pressed }) => [
        styles.swipeAction,
        { opacity: pressed ? 0.86 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
      accessibilityLabel="Eliminar evento"
      accessibilityRole="button"
    >
      <IconSymbol name="trash.fill" size={18} color="#fff" />
      <Text style={styles.swipeActionLabel}>Eliminar</Text>
    </Pressable>
  );

  const card = (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={[styles.timeText, { color: c.textMuted }]}>{timeLabel}</Text>
      </View>

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
          <View style={styles.kindRow}>
            <View style={[styles.kindChip, { backgroundColor: kindColors.badge }]}>
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
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.doneCircle,
                    {
                      borderColor: done ? c.success : c.borderStrong,
                      backgroundColor: done ? c.success : 'transparent',
                      opacity: pressed ? 0.72 : 1,
                      transform: [{ scale: pressed ? 0.9 : 1 }],
                    },
                  ]}
                  accessibilityLabel={done ? 'Desmarcar evento' : 'Marcar evento hecho'}
                  accessibilityRole="button"
                >
                  {done ? (
                    <IconSymbol name="checkmark" size={11} color={'#ffffff'} weight="bold" />
                  ) : null}
                </Pressable>
              ) : null}

              {onDeletePress ? (
                <Pressable
                  onPress={onDeletePress}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    {
                      backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                      opacity: pressed ? 0.72 : 0.55,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                  accessibilityLabel="Eliminar evento"
                  accessibilityRole="button"
                >
                  <IconSymbol name="trash.fill" size={12} color={c.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {hasDescription ? (
            <Text style={[styles.description, { color: c.textMuted }]} numberOfLines={2}>
              {descriptionParts.body}
            </Text>
          ) : null}

          {descriptionParts.reminders.length > 0 ? (
            <View style={styles.linkedReminderList}>
              {descriptionParts.reminders.map((reminder, idx) => (
                <View key={`${reminder}-${idx}`} style={styles.linkedReminderRow}>
                  <IconSymbol name="bell.fill" size={11} color="#d97706" />
                  <Text style={styles.linkedReminderText} numberOfLines={2}>
                    {reminder}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  if (!onSwipeDelete && !onDeletePress) return card;

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={DELETE_WIDTH * 0.6}
      overshootRight={false}
      containerStyle={styles.swipeContainer}
    >
      {card}
    </Swipeable>
  );
}

// Sin React.memo: ver nota en TimelineEventBlock — reactCompiler:true
// hace memoización automática; wrapping manual rompe Fabric.

const styles = StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    columnGap: COL_GAP,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'transparent',
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
    borderLeftWidth: 3,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 3,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  kindRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  kindChip: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  kindChipText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.bodyStrong,
    fontSize: 14,
    lineHeight: 19,
    flex: 1,
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  doneCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    paddingTop: 1,
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  description: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  linkedReminderList: {
    gap: 3,
    marginTop: 2,
  },
  linkedReminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  linkedReminderText: {
    flex: 1,
    color: '#b45309',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  // Acción swipe roja — estilo iOS nativo
  swipeAction: {
    width: DELETE_WIDTH,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: Spacing['3xl'],
    borderRadius: 14,
    marginRight: Spacing.lg,
  },
  swipeActionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
