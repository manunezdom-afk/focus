import * as Haptics from 'expo-haptics';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Task } from '@/src/data/types';

type Props = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

// Fila de tarea estilo iOS list. Tap = toggle done con haptic Light.
// Long-press = Alert de confirmación para borrar (haptic Warning antes).
//
// Hit target: row entera tiene ≥48px de alto (fila + paddingVertical=14
// → 16+14*2 = 44 de contenido, +2 por borde inferior). Cumple HIG.
export function TaskRow({ task, onToggle, onDelete }: Props) {
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

  return (
    <Pressable
      onPress={handleToggle}
      onLongPress={handleLongPress}
      delayLongPress={400}
      android_ripple={{ color: c.border }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.surface,
          borderBottomColor: c.border,
          opacity: pressed ? 0.7 : 1,
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
            borderColor: task.done ? c.accent : c.border,
            backgroundColor: task.done ? c.accent : 'transparent',
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  body: { flex: 1 },
  label: { fontSize: 16, lineHeight: 22 },
});
