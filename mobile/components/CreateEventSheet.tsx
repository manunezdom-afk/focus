import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
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

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, todayISO } from '@/src/data/today';
import type { CreateEventInput } from '@/src/data/events';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (input: CreateEventInput) => Promise<boolean>;
  defaultDate?: string | null;
};

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

const TIME_PRESETS = ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function firstGridMonday(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  const firstOfMonth = new Date(y, m - 1, 1, 12, 0, 0);
  const offsetFromMonday = (firstOfMonth.getDay() + 6) % 7;
  const d = new Date(firstOfMonth);
  d.setDate(firstOfMonth.getDate() - offsetFromMonday);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthLabel(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  const name = MONTH_NAMES[m - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

function shiftMonth(dateISO: string, delta: number): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  const next = new Date(y, m - 1 + delta, 1, 12, 0, 0);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
}

function inMonth(dayISO: string, refISO: string): boolean {
  return dayISO.slice(0, 7) === refISO.slice(0, 7);
}

// Etiqueta humana — "Hoy", "Mañana" o "Jueves, 8 de mayo".
function humanDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  if (iso === todayISO()) return 'Hoy';
  if (iso === addDaysISO(todayISO(), 1)) return 'Mañana';
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10));
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const weekday = date.toLocaleDateString('es-MX', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${d} de ${MONTH_NAMES[m - 1]}`;
}

// Validación liviana de "HH:MM" o "HH:MM-HH:MM" (24h).
function isValidTime(t: string): boolean {
  if (!t.trim()) return true;
  return /^\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?$/.test(t.replace(/\s/g, ''));
}

export function CreateEventSheet({ visible, onDismiss, onSubmit, defaultDate }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [title, setTitle] = useState('');
  const [date, setDate] = useState<string | null>(defaultDate ?? todayISO());
  const [time, setTime] = useState<string>('');
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El mes que está mostrando el calendario inline. Por default = mes del
  // día seleccionado, o mes actual si no hay fecha.
  const [viewMonth, setViewMonth] = useState<string>(date ?? todayISO());

  useEffect(() => {
    if (visible) {
      const initial = defaultDate ?? todayISO();
      setTitle('');
      setDate(initial);
      setTime('');
      setCustomTimeOpen(false);
      setDescription('');
      setError(null);
      setSubmitting(false);
      setViewMonth(initial);
    }
  }, [visible, defaultDate]);

  // Construye los 42 días de la grilla (6 semanas × 7).
  const gridDays = useMemo(() => {
    const start = firstGridMonday(viewMonth);
    return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i));
  }, [viewMonth]);

  const canSubmit = title.trim().length > 0 && isValidTime(time) && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const ok = await onSubmit({
      title: title.trim(),
      date: date,
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

  function handleChip(value: string | null) {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    setDate(value);
    if (value) setViewMonth(value);
  }

  function handleDayTap(dayISO: string) {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    setDate(dayISO);
  }

  function handleTimeChip(value: string) {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    setTime(value);
    setCustomTimeOpen(false);
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
            <Pressable onPress={onDismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar">
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
              <View style={[styles.errorBox, { backgroundColor: c.surface, borderColor: c.danger }]}>
                <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
              </View>
            ) : null}

            {/* TÍTULO */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Título</Text>
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
            </View>

            {/* FECHA — chips + calendar grid inline */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Fecha</Text>
                <Text style={[styles.sectionValue, { color: c.text }]}>{humanDate(date)}</Text>
              </View>

              <View style={styles.chipsRow}>
                <DateChip label="Sin fecha" active={date === null} onPress={() => handleChip(null)} c={c} />
                <DateChip label="Hoy" active={date === todayISO()} onPress={() => handleChip(todayISO())} c={c} />
                <DateChip
                  label="Mañana"
                  active={date === addDaysISO(todayISO(), 1)}
                  onPress={() => handleChip(addDaysISO(todayISO(), 1))}
                  c={c}
                />
              </View>

              {/* Mini calendario inline */}
              <View style={[styles.calendar, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.calHead}>
                  <Pressable
                    onPress={() => setViewMonth(shiftMonth(viewMonth, -1))}
                    hitSlop={10}
                    style={({ pressed }) => [styles.calNav, { opacity: pressed ? 0.5 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Mes anterior"
                  >
                    <IconSymbol name="chevron.left" size={18} color={c.textMuted} />
                  </Pressable>
                  <Text style={[styles.calTitle, { color: c.text }]}>{monthLabel(viewMonth)}</Text>
                  <Pressable
                    onPress={() => setViewMonth(shiftMonth(viewMonth, 1))}
                    hitSlop={10}
                    style={({ pressed }) => [styles.calNav, { opacity: pressed ? 0.5 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Mes siguiente"
                  >
                    <IconSymbol name="chevron.right" size={18} color={c.textMuted} />
                  </Pressable>
                </View>

                <View style={styles.weekRow}>
                  {WEEKDAYS.map((w, i) => (
                    <Text key={`w-${i}`} style={[styles.weekDay, { color: c.textSubtle }]}>
                      {w}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysGrid}>
                  {gridDays.map((d) => {
                    const dayNum = parseInt(d.split('-')[2], 10);
                    const muted = !inMonth(d, viewMonth);
                    const selected = d === date;
                    const isToday = d === todayISO();
                    return (
                      <Pressable
                        key={d}
                        onPress={() => handleDayTap(d)}
                        style={({ pressed }) => [
                          styles.dayCell,
                          selected && { backgroundColor: c.primary },
                          !selected && isToday && { borderColor: c.primary, borderWidth: 1.5 },
                          { opacity: pressed ? 0.6 : 1 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={d}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            {
                              color: selected
                                ? c.onPrimary
                                : muted
                                  ? c.textSubtle
                                  : c.text,
                              fontWeight: selected || isToday ? '700' : '500',
                            },
                          ]}
                        >
                          {dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* HORA — chips + custom time toggle */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Hora</Text>
                <Text style={[styles.sectionValue, { color: c.text }]}>
                  {time || 'Todo el día'}
                </Text>
              </View>

              <View style={styles.chipsRow}>
                <TimeChip label="Todo el día" active={!time} onPress={() => handleTimeChip('')} c={c} />
                {TIME_PRESETS.map((t) => (
                  <TimeChip key={t} label={t} active={time === t} onPress={() => handleTimeChip(t)} c={c} />
                ))}
              </View>

              {/* Toggle hora personalizada */}
              <Pressable
                onPress={() => setCustomTimeOpen((v) => !v)}
                hitSlop={6}
                style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Hora personalizada"
              >
                <IconSymbol
                  name={customTimeOpen ? 'chevron.down' : 'chevron.right'}
                  size={12}
                  color={c.textMuted}
                />
                <Text style={[styles.moreText, { color: c.textMuted }]}>
                  {customTimeOpen ? 'Cerrar hora personalizada' : 'Otra hora o rango (9:30, 14:00-15:30)'}
                </Text>
              </Pressable>

              {customTimeOpen ? (
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="9:30 o 14:00-15:30"
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
              ) : null}
            </View>

            {/* NOTAS */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Notas</Text>
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
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function DateChip({
  label,
  active,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.surface,
          borderColor: active ? c.primary : c.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? c.onPrimary : c.text, fontWeight: active ? '700' : '500' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TimeChip({
  label,
  active,
  onPress,
  c,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.surface,
          borderColor: active ? c.primary : c.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? c.onPrimary : c.text, fontWeight: active ? '700' : '500' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
    gap: Spacing.xl,
  },

  errorBox: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  errorText: { ...Typography.caption, fontWeight: '600' },

  section: { gap: Spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionValue: {
    ...Typography.bodyStrong,
    fontSize: 15,
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    ...Typography.body,
    minHeight: 48,
  },
  inputMulti: {
    minHeight: 88,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 18,
  },

  // Calendario inline
  calendar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  calNav: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  calTitle: {
    ...Typography.bodyStrong,
    fontSize: 15,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    paddingVertical: 2,
  },
  dayText: {
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },

  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  moreText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
