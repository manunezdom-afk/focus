import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getBlockColors } from '@/src/data/blockColors';
import type { Task } from '@/src/data/types';

type Props = {
  task: Task;
  onToggle?: (id: string) => void;
  onDeletePress?: () => void;
  // Swipe-to-delete: borra sin Alert (la intención del gesto es suficiente).
  onSwipeDelete?: () => void;
  enterIndex?: number;
};

const DOT_SIZE = 8;
const COL_GAP = 20;
const DELETE_WIDTH = 80;

export function TimelineTaskBlock({ task, onToggle, onDeletePress, onSwipeDelete, enterIndex = 0 }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const taskColors = getBlockColors('task', scheme);
  const accent = taskColors.accent;
  const enterDelay = Math.min(30 + enterIndex * 18, 110);

  const renderRightActions = () => (
    <Pressable
      onPress={onSwipeDelete ?? onDeletePress}
      style={({ pressed }) => [
        styles.swipeAction,
        { opacity: pressed ? 0.86 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
      accessibilityLabel="Eliminar tarea"
      accessibilityRole="button"
    >
      <IconSymbol name="trash.fill" size={18} color="#fff" />
      <Text style={styles.swipeActionLabel}>Eliminar</Text>
    </Pressable>
  );

  const card = (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(180)}
      style={styles.row}
    >
      <View style={styles.timeCol}>
        <IconSymbol name="checklist" size={18} color={c.textSubtle} />
      </View>

      <View style={styles.cardCol}>
        <View style={[styles.dot, { backgroundColor: accent }]} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              borderLeftColor: accent,
            },
          ]}
        >
          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <View style={[styles.badge, { backgroundColor: taskColors.badge }]}>
                <Text style={[styles.badgeText, { color: taskColors.badgeText }]}>
                  TAREA · {task.priority.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                {task.label}
              </Text>
            </View>

            <View style={styles.actionsCol}>
              {onToggle ? (
                <Pressable
                  onPress={() => onToggle(task.id)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.doneBtn,
                    {
                      backgroundColor: c.primaryContainer,
                      opacity: pressed ? 0.78 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                  accessibilityLabel="Marcar tarea hecha"
                  accessibilityRole="button"
                >
                  <Text style={[styles.doneBtnText, { color: c.primary }]}>HECHO ✓</Text>
                </Pressable>
              ) : null}

              {onDeletePress ? (
                <Pressable
                  onPress={onDeletePress}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    {
                      backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                      opacity: pressed ? 0.72 : 1,
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    },
                  ]}
                  accessibilityLabel="Eliminar tarea"
                  accessibilityRole="button"
                >
                  <IconSymbol name="trash.fill" size={14} color={c.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
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

// Sin React.memo: reactCompiler:true hace memoización automática.

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
    paddingTop: 12,
    alignItems: 'flex-end',
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
    borderRadius: 16,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  titleCol: {
    flex: 1,
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    ...Typography.bodyStrong,
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
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  swipeAction: {
    width: DELETE_WIDTH,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: Spacing['3xl'],
    borderRadius: 16,
    marginRight: Spacing.lg,
  },
  swipeActionLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
