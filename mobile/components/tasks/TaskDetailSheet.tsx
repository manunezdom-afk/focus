import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TaskPatch } from '@/src/data/tasks';
import type { Task, TaskPriority } from '@/src/data/types';

const PRIORITIES: TaskPriority[] = ['Alta', 'Media', 'Baja'];
const CATEGORIES = ['hoy', 'semana', 'algún día'] as const;
const CAT_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  'algún día': 'Algún día',
};

type Props = {
  task: Task | null;
  visible: boolean;
  onDismiss: () => void;
  onSave: (id: string, patch: TaskPatch) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
};

// Modal de detalle/edición de tarea. Permite cambiar label, prioridad y
// categoría; también borra con confirmación. La fila sigue manejando tap
// para toggle done — esta hoja se abre con long-press.
export function TaskDetailSheet({ task, visible, onDismiss, onSave, onDelete }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [label, setLabel] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Media');
  const [category, setCategory] = useState<string>('hoy');
  const [saving, setSaving] = useState(false);

  // Sincroniza el estado local cuando cambia la tarea seleccionada.
  useEffect(() => {
    if (task) {
      setLabel(task.label);
      setPriority(task.priority);
      setCategory(task.category || 'hoy');
    }
  }, [task]);

  if (!task) return null;

  const trimmed = label.trim();
  const dirty =
    trimmed !== task.label || priority !== task.priority || category !== (task.category || 'hoy');
  const canSave = dirty && trimmed.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    const patch: TaskPatch = {};
    if (trimmed !== task!.label) patch.label = trimmed;
    if (priority !== task!.priority) patch.priority = priority;
    if (category !== (task!.category || 'hoy')) patch.category = category;
    try {
      await onSave(task!.id, patch);
      onDismiss();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (Platform.OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      '¿Eliminar tarea?',
      `"${task!.label}" se eliminará. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await onDelete(task!.id);
            onDismiss();
          },
        },
      ],
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {/* Empty pressable = backdrop tap to close. La hoja captura tap dentro. */}
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kbd}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <Text style={[styles.heading, { color: c.text }]}>Editar tarea</Text>

            {/* Label */}
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Tarea</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="¿Qué necesitas hacer?"
              placeholderTextColor={c.textSubtle}
              style={[
                styles.input,
                { color: c.text, borderColor: c.border, backgroundColor: c.surfaceMuted },
              ]}
              multiline
              autoCorrect
              autoCapitalize="sentences"
              maxLength={200}
            />

            {/* Prioridad */}
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Prioridad</Text>
            <View style={styles.chipRow}>
              {PRIORITIES.map((p) => {
                const active = p === priority;
                return (
                  <Pressable
                    key={p}
                    onPress={() => {
                      if (Platform.OS === 'ios') void Haptics.selectionAsync();
                      setPriority(p);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: active ? c.primaryContainer : c.surfaceMuted,
                        borderColor: active ? c.primary : c.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? c.primary : c.textMuted, fontWeight: active ? '700' : '500' },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Categoría */}
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Cuándo</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => {
                const active = cat === category;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      if (Platform.OS === 'ios') void Haptics.selectionAsync();
                      setCategory(cat);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: active ? c.primaryContainer : c.surfaceMuted,
                        borderColor: active ? c.primary : c.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? c.primary : c.textMuted, fontWeight: active ? '700' : '500' },
                      ]}
                    >
                      {CAT_LABELS[cat]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Acciones */}
            <View style={styles.actions}>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: canSave ? (pressed ? c.primaryPressed : c.primary) : c.surfaceMuted,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Guardar cambios"
              >
                <Text style={[styles.primaryBtnText, { color: canSave ? c.onPrimary : c.textSubtle }]}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { borderColor: c.border, opacity: pressed ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Eliminar tarea"
              >
                <IconSymbol name="trash" size={15} color={'#dc2626'} />
                <Text style={[styles.deleteText, { color: '#dc2626' }]}>Eliminar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  kbd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingBottom: Spacing['2xl'],
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.2,
    marginBottom: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 44,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  actions: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryBtn: {
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  deleteBtn: {
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
