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
import { addDaysISO, todayISO } from '@/src/data/today';
import type { Task, TaskPriority } from '@/src/data/types';

const PRIORITIES: TaskPriority[] = ['Alta', 'Media', 'Baja'];
const CATEGORIES = ['hoy', 'semana', 'algún día'] as const;
const CAT_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  'algún día': 'Algún día',
};

// Validación de formato. Campos vacíos ('' o whitespace) → null.
//   YYYY-MM-DD: año 4 digits, mes 1-12, día 1-31. No checa días por mes
//   (febrero 30 pasaría) — el server hará la validación final si es
//   crítico. Para una task date eso es aceptable.
//   HH:MM o HH:MM-HH:MM
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(\s*-\s*([01]\d|2[0-3]):[0-5]\d)?$/;

function normalizeDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return DATE_RE.test(t) ? t : 'INVALID';
}

function normalizeTime(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return TIME_RE.test(t) ? t.replace(/\s/g, '') : 'INVALID';
}

function humanDateLabel(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  if (iso === todayISO()) return 'Hoy';
  if (iso === addDaysISO(todayISO(), 1)) return 'Mañana';
  return iso;
}

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
  const [dueDateText, setDueDateText] = useState('');
  const [dueTimeText, setDueTimeText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sincroniza el estado local cuando cambia la tarea seleccionada.
  useEffect(() => {
    if (task) {
      setLabel(task.label);
      setPriority(task.priority);
      setCategory(task.category || 'hoy');
      setDueDateText(task.dueDate ?? '');
      setDueTimeText(task.dueTime ?? '');
      setSaveError(null);
    }
  }, [task]);

  if (!task) return null;

  const trimmed = label.trim();
  // Normalizamos fecha/hora una vez para detectar dirty + validez.
  // 'INVALID' significa que el usuario tipeó algo que no parsea — no
  // se considera "limpio" (no podés guardar una basura).
  const dueDateNormalized = normalizeDate(dueDateText); // null | 'INVALID' | 'YYYY-MM-DD'
  const dueTimeNormalized = normalizeTime(dueTimeText);
  const dueDateInvalid = dueDateNormalized === 'INVALID';
  const dueTimeInvalid = dueTimeNormalized === 'INVALID';
  const newDueDate = dueDateInvalid ? task.dueDate : dueDateNormalized; // null o 'YYYY-MM-DD'
  const newDueTime = dueTimeInvalid ? task.dueTime : dueTimeNormalized;

  const dirty =
    trimmed !== task.label ||
    priority !== task.priority ||
    category !== (task.category || 'hoy') ||
    newDueDate !== (task.dueDate ?? null) ||
    newDueTime !== (task.dueTime ?? null);
  const canSave =
    dirty && trimmed.length > 0 && !saving && !dueDateInvalid && !dueTimeInvalid;

  function applyQuickDueDate(value: string | null) {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setDueDateText(value ?? '');
    // Si quitamos la fecha, también quitamos la hora (no tiene sentido
    // agendar HH:MM sin día).
    if (!value) setDueTimeText('');
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    const patch: TaskPatch = {};
    if (trimmed !== task!.label) patch.label = trimmed;
    if (priority !== task!.priority) patch.priority = priority;
    if (category !== (task!.category || 'hoy')) patch.category = category;
    if (newDueDate !== (task!.dueDate ?? null)) patch.dueDate = newDueDate;
    if (newDueTime !== (task!.dueTime ?? null)) patch.dueTime = newDueTime;
    try {
      await onSave(task!.id, patch);
      onDismiss();
    } catch (err: any) {
      // Si la migración 017 no está aplicada y el usuario seteó dueDate
      // o dueTime, el server tira "column does not exist". Mostramos
      // mensaje accionable en lugar de tragarlo.
      const msg = String(err?.message ?? '');
      if (/does not exist|42703/i.test(msg) && (patch.dueDate || patch.dueTime)) {
        setSaveError(
          'Las columnas de fecha aún no están en el servidor. Aplica la migración 017_task_due_dates.sql en Supabase Dashboard.',
        );
      } else {
        setSaveError(msg || 'No pudimos guardar. Reintenta.');
      }
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

            {/* Fecha (opcional) — chips rápidos + texto manual.
                Requiere migration 017_task_due_dates.sql en server. */}
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
              Fecha (opcional)
            </Text>
            <View style={styles.chipRow}>
              {[
                { id: 'today',     label: 'Hoy',         value: todayISO() },
                { id: 'tomorrow',  label: 'Mañana',      value: addDaysISO(todayISO(), 1) },
                { id: 'nextweek',  label: 'En 7 días',   value: addDaysISO(todayISO(), 7) },
                { id: 'none',      label: 'Sin fecha',   value: null },
              ].map((opt) => {
                const active = (newDueDate ?? null) === opt.value;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => applyQuickDueDate(opt.value)}
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
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={dueDateText}
              onChangeText={setDueDateText}
              placeholder="YYYY-MM-DD (vacío = sin fecha)"
              placeholderTextColor={c.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={[
                styles.dateInput,
                {
                  color: c.text,
                  borderColor: dueDateInvalid ? '#dc2626' : c.border,
                  backgroundColor: c.surfaceMuted,
                },
              ]}
              accessibilityLabel="Fecha en formato AAAA-MM-DD"
            />
            {dueDateInvalid ? (
              <Text style={[styles.errorHint, { color: '#dc2626' }]}>
                Formato inválido. Usa YYYY-MM-DD (ej: 2026-12-31) o deja vacío.
              </Text>
            ) : null}

            {/* Hora (solo si hay fecha — sino no tiene sentido) */}
            {newDueDate ? (
              <>
                <Text style={[styles.fieldLabel, { color: c.textMuted }]}>
                  Hora (opcional)
                </Text>
                <TextInput
                  value={dueTimeText}
                  onChangeText={setDueTimeText}
                  placeholder="HH:MM o HH:MM-HH:MM"
                  placeholderTextColor={c.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  maxLength={11}
                  style={[
                    styles.dateInput,
                    {
                      color: c.text,
                      borderColor: dueTimeInvalid ? '#dc2626' : c.border,
                      backgroundColor: c.surfaceMuted,
                    },
                  ]}
                  accessibilityLabel="Hora en formato HH:MM"
                />
                {dueTimeInvalid ? (
                  <Text style={[styles.errorHint, { color: '#dc2626' }]}>
                    Formato inválido. Usa HH:MM (ej: 09:30) o HH:MM-HH:MM.
                  </Text>
                ) : null}
              </>
            ) : null}

            {/* Resumen humano cuando hay fecha — confirma al usuario qué
                va a guardarse antes del tap en "Guardar". */}
            {newDueDate ? (
              <Text style={[styles.dueSummary, { color: c.textSubtle }]}>
                Programada para {humanDateLabel(newDueDate)}
                {newDueTime ? ` · ${newDueTime}` : ''}
              </Text>
            ) : null}

            {saveError ? (
              <View
                style={[
                  styles.errorBox,
                  { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
                ]}
              >
                <IconSymbol name="xmark" size={14} color={'#dc2626'} />
                <Text style={[styles.errorText, { color: '#dc2626' }]} numberOfLines={4}>
                  {saveError}
                </Text>
              </View>
            ) : null}

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
  dateInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    lineHeight: 21,
    minHeight: 40,
    fontVariant: ['tabular-nums'],
  },
  dueSummary: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  errorHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: -4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
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
