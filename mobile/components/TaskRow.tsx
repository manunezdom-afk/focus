import * as Haptics from 'expo-haptics';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import type { Task } from '@/src/data/types';

type Props = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  // Si se pasa, se muestra un botón "↔" inline para mover la tarea entre buckets.
  onCycleCategory?: (id: string, current: string) => void;
  // Oculta el priority badge cuando la fila va dentro de un contexto donde no
  // tiene sentido (ej: lista compacta de Mi Día con priority menos relevante).
  showPriority?: boolean;
};

// Fila de tarea estilo iOS list.
// - Tap = toggle done con haptic Light + animación visual via opacity
// - Long-press = Alert de confirmación → delete (haptic Warning antes)
// - Optional onCycleCategory = botón inline para mover entre hoy/semana/algún día
//
// Match legacy TasksView item:
//   px-3 py-2.5 rounded-xl border bg-surface-container-lowest
//   checkmark + label + priority badge
export function TaskRow({ task, onToggle, onDelete, onCycleCategory, showPriority = true }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function handleToggle() {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle(task.id);
  }

  function handleLongPress() {
    if (Platform.OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      'Borrar tarea',
      `¿Borrar "${task.label}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => onDelete(task.id),
        },
      ],
      { cancelable: true },
    );
  }

  function handleCycle() {
    if (!onCycleCategory) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onCycleCategory(task.id, task.category);
  }

  return (
    <Pressable
      onPress={handleToggle}
      onLongPress={handleLongPress}
      delayLongPress={400}
      android_ripple={{ color: c.surfaceMuted }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.surface,
          borderBottomColor: c.border,
          opacity: pressed ? 0.7 : task.done ? 0.55 : 1,
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityLabel={task.label}
      accessibilityHint="Toca para alternar completado. Mantén presionado para borrar."
    >
      <View
        style={[
          styles.check,
          {
            borderColor: task.done ? c.primary : c.borderStrong,
            backgroundColor: task.done ? c.primary : 'transparent',
          },
        ]}
      >
        {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <View style={styles.body}>
        <Text
          style={[
            styles.label,
            {
              color: task.done ? c.textMuted : c.text,
              textDecorationLine: task.done ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {task.label}
        </Text>
      </View>
      {showPriority ? <PriorityBadge priority={task.priority} /> : null}
      {onCycleCategory ? (
        <Pressable
          onPress={handleCycle}
          hitSlop={8}
          style={styles.cycleBtn}
          accessibilityLabel="Mover a otro bucket"
          accessibilityRole="button"
        >
          <Text style={[styles.cycleIcon, { color: c.textSubtle }]}>↔</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  body: { flex: 1 },
  label: { ...Typography.body, fontSize: 15, lineHeight: 21 },
  cycleBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
});
