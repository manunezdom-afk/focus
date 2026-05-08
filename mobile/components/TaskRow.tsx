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
  // Si se pasa, long-press abre el detail sheet en lugar del Alert de borrado.
  // Cuando es undefined, mantiene el comportamiento clásico (long-press = delete).
  onOpenDetail?: (task: Task) => void;
  // Oculta el priority badge cuando la fila va dentro de un contexto donde no
  // tiene sentido (ej: lista compacta de Mi Día con priority menos relevante).
  showPriority?: boolean;
  // Modo de selección múltiple (bulk defer). Cuando es true:
  //   - tap en row hace onToggleSelected en lugar de onToggle (done).
  //   - el checkbox refleja `selected`.
  //   - long-press se desactiva.
  // Si selectionMode=true pero no se pasa onToggleSelected, hacemos nada en tap.
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelected?: (id: string) => void;
};

// Fila de tarea estilo iOS list.
// - Tap = toggle done con haptic Light + animación visual via opacity
// - Long-press = abre detail sheet (si onOpenDetail) o Alert delete (fallback)
// - Optional onCycleCategory = botón inline para mover entre hoy/semana/algún día
//
// Match legacy TasksView item:
//   px-3 py-2.5 rounded-xl border bg-surface-container-lowest
//   checkmark + label + priority badge
export function TaskRow({
  task,
  onToggle,
  onDelete,
  onCycleCategory,
  onOpenDetail,
  showPriority = true,
  selectionMode = false,
  selected = false,
  onToggleSelected,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function handlePress() {
    if (selectionMode) {
      // Tap en row durante bulk defer: toggle selección, no toggle done.
      if (Platform.OS === 'ios') {
        void Haptics.selectionAsync();
      }
      onToggleSelected?.(task.id);
      return;
    }
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggle(task.id);
  }

  function handleLongPress() {
    if (selectionMode) return; // No long-press cuando estamos seleccionando.
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (onOpenDetail) {
      onOpenDetail(task);
      return;
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

  // El "checkbox" del row tiene 2 modos visuales:
  //   - selectionMode=true → cuadrado relleno con tick si selected, vacío si no
  //   - selectionMode=false → círculo (chequeo de done) — comportamiento legacy
  const checkboxBorderColor = selectionMode
    ? selected
      ? c.primary
      : c.borderStrong
    : task.done
      ? c.primary
      : c.borderStrong;
  const checkboxBg = selectionMode
    ? selected
      ? c.primary
      : 'transparent'
    : task.done
      ? c.primary
      : 'transparent';
  const checkboxBorderRadius = selectionMode ? 6 : 11;
  const showTick = selectionMode ? selected : task.done;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      android_ripple={{ color: c.surfaceMuted }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.surface,
          borderBottomColor: c.border,
          opacity: pressed ? 0.82 : task.done && !selectionMode ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.995 : 1 }],
        },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selectionMode ? selected : task.done }}
      accessibilityLabel={task.label}
      accessibilityHint={
        selectionMode
          ? 'Toca para seleccionar o deseleccionar.'
          : 'Toca para alternar completado. Mantén presionado para más opciones.'
      }
    >
      <View
        style={[
          styles.check,
          {
            borderColor: checkboxBorderColor,
            backgroundColor: checkboxBg,
            borderRadius: checkboxBorderRadius,
          },
        ]}
      >
        {showTick ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <View style={styles.body}>
        <Text
          style={[
            styles.label,
            {
              color: task.done && !selectionMode ? c.textMuted : c.text,
              textDecorationLine: task.done && !selectionMode ? 'line-through' : 'none',
            },
          ]}
          numberOfLines={2}
        >
          {task.label}
        </Text>
      </View>
      {/* En selectionMode escondemos badge + botón cycle para que el row
          se vea limpio y el foco esté en el checkbox. */}
      {!selectionMode && showPriority ? <PriorityBadge priority={task.priority} /> : null}
      {!selectionMode && onCycleCategory ? (
        <Pressable
          onPress={handleCycle}
          hitSlop={8}
          style={({ pressed }) => [
            styles.cycleBtn,
            {
              backgroundColor: pressed ? c.surfaceMuted : 'transparent',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          accessibilityLabel="Mover a otro bucket"
          accessibilityRole="button"
        >
          <Text style={[styles.cycleIcon, { color: c.textSubtle }]}>↔</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// Sin React.memo: ver nota en TimelineEventBlock.tsx — reactCompiler:true
// hace memoización automática y wrapping manual rompe Fabric.

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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
});
