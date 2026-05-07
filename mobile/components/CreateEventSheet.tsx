import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayISO } from '@/src/data/today';
import type { CreateEventInput } from '@/src/data/events';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  // Devuelve true si se creó, false si error/cancel.
  onSubmit: (input: CreateEventInput) => Promise<boolean>;
  defaultDate?: string | null; // 'YYYY-MM-DD'
};

// Validación liviana de "HH:MM" o "HH:MM-HH:MM" (24h). Coincide con lo que
// el backend espera. Si está vacío, OK (evento sin hora).
function isValidTime(t: string): boolean {
  if (!t.trim()) return true;
  return /^\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?$/.test(t.replace(/\s/g, ''));
}

function isValidDate(d: string): boolean {
  if (!d.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(d.trim());
}

export function CreateEventSheet({ visible, onDismiss, onSubmit, defaultDate }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string>(defaultDate ?? todayISO());
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al abrir
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDate(defaultDate ?? todayISO());
      setTime('');
      setDescription('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible, defaultDate]);

  const canSubmit =
    title.trim().length > 0 && isValidTime(time) && isValidDate(date) && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const ok = await onSubmit({
      title: title.trim(),
      date: date.trim() || null,
      time: time.replace(/\s/g, '') || null,
      description: description.trim() || undefined,
    });
    setSubmitting(false);
    if (ok) {
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onDismiss();
    } else {
      setError('No pudimos crear el evento. Intenta otra vez.');
    }
  }

  return (
    <Modal
      animationType="slide"
      presentationStyle="formSheet"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <Pressable
              onPress={onDismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Text style={[styles.headerBtn, { color: c.textMuted }]}>Cancelar</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: c.text }]}>Nuevo evento</Text>
            <Pressable
              onPress={handleSubmit}
              disabled={!canSubmit}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Guardar evento"
            >
              <Text
                style={[
                  styles.headerBtn,
                  styles.headerBtnPrimary,
                  { color: canSubmit ? c.primary : c.textSubtle },
                ]}
              >
                Guardar
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {error ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: c.surface, borderColor: c.danger },
                ]}
              >
                <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Field label="Título" hint="¿De qué se trata el evento?">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Ej. Llamada con Jacob"
                placeholderTextColor={c.textSubtle}
                style={[
                  styles.input,
                  { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                ]}
                autoCapitalize="sentences"
                autoFocus
                maxLength={120}
              />
            </Field>

            <Field
              label="Fecha"
              hint="Formato YYYY-MM-DD. Vacío = sin fecha (queda en 'Sin fecha')."
            >
              <TextInput
                value={date}
                onChangeText={setDate}
                placeholder="2026-05-08"
                placeholderTextColor={c.textSubtle}
                style={[
                  styles.input,
                  { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </Field>

            <Field label="Hora" hint="HH:MM o HH:MM-HH:MM (24h). Vacío = todo el día.">
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="09:00 — opcional"
                placeholderTextColor={c.textSubtle}
                style={[
                  styles.input,
                  { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                maxLength={11}
              />
            </Field>

            <Field label="Notas">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Añade detalles, link de videollamada, dirección…"
                placeholderTextColor={c.textSubtle}
                style={[
                  styles.input,
                  styles.inputMulti,
                  { backgroundColor: c.surface, borderColor: c.border, color: c.text },
                ]}
                multiline
                maxLength={500}
              />
            </Field>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={fieldStyles.box}>
      <Text style={[fieldStyles.label, { color: c.textMuted }]}>{label}</Text>
      {children}
      {hint ? <Text style={[fieldStyles.hint, { color: c.textSubtle }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...Typography.title3 },
  headerBtn: { ...Typography.body },
  headerBtnPrimary: { fontWeight: '700' },

  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },

  errorBox: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorText: { ...Typography.caption, fontWeight: '600' },

  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    ...Typography.body,
    minHeight: 48,
  },
  inputMulti: {
    minHeight: 96,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
});

const fieldStyles = StyleSheet.create({
  box: { gap: Spacing.xs },
  label: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hint: { ...Typography.caption, marginTop: 2 },
});
