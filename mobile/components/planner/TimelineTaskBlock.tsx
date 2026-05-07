import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Task } from '@/src/data/types';

type Props = {
  task: Task;
  onToggle?: (id: string) => void;
  onDeletePress?: () => void;
};

const DOT_SIZE = 8;
const COL_GAP = 20;

function priorityAccent(c: ReturnType<typeof getColors>, p: string): string {
  if (p === 'Alta') return c.danger;
  if (p === 'Baja') return c.borderStrong;
  return c.primary;
}

// Helper para tipar el retorno de Colors[scheme] sin importar paleta cruda.
function getColors(scheme: 'light' | 'dark') {
  return Colors[scheme];
}

export function TimelineTaskBlock({ task, onToggle, onDeletePress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = getColors(scheme);

  const accent = priorityAccent(c, task.priority);

  return (
    <View style={styles.row}>
      {/* Columna izquierda: ícono check_box (en lugar de hora) */}
      <View style={styles.timeCol}>
        <IconSymbol name="checklist" size={18} color={c.textSubtle} />
      </View>

      <View style={styles.cardCol}>
        {/* Dot conector — color apagado para distinguir tareas de eventos */}
        <View style={[styles.dot, { backgroundColor: c.borderStrong }]} />

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
              <View style={[styles.badge, { backgroundColor: c.surfaceTint }]}>
                <Text style={[styles.badgeText, { color: c.primary }]}>
                  PENDIENTE DE HOY
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
                      opacity: pressed ? 0.6 : 1,
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
                    { opacity: pressed ? 0.5 : 1 },
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
  // Card suave consistente con TimelineEventBlock: borderRadius amplio,
  // acento lateral fino + shadow muy sutil.
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
  },
});
