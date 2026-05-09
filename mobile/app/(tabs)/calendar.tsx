import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { CreateEventSheet } from '@/components/CreateEventSheet';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { SwipeNavigator } from '@/components/navigation/SwipeNavigator';
import { DayPicker } from '@/components/calendar/DayPicker';
import { DayTimeline } from '@/components/calendar/DayTimeline';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { AmbientNova } from '@/components/nova/AmbientNova';
import { NovaInputBar } from '@/components/nova/NovaInputBar';
import { GeminiSurface } from '@/components/ui/GeminiSurface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setNovaSeed } from '@/src/data/novaSeedStore';
import { addDaysISO, isToday, todayISO } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

const MONTH_NAMES_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
] as const;

function monthYearLabel(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  if (!y || !m) return '';
  const name = MONTH_NAMES_ES[m - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

// Vistas del toggle — Día con timeline, Semana en lista vertical, Mes en grilla.
const VIEWS = ['Día', 'Semana', 'Mes'] as const;
type CalView = (typeof VIEWS)[number];

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const events = useEvents('all');
  const tasks = useTasks();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [activeView, setActiveView] = useState<CalView>('Día');
  const [showSheet, setShowSheet] = useState(false);

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events.events) {
      if (e.date) counts[e.date] = (counts[e.date] ?? 0) + 1;
    }
    return counts;
  }, [events.events]);

  const eventsForSelectedDay = useMemo(
    () => events.events.filter((e) => e.date === selectedDate),
    [events.events, selectedDate],
  );

  const monthLabel = useMemo(() => monthYearLabel(selectedDate), [selectedDate]);

  function selectDay(dateISO: string) {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setSelectedDate(dateISO);
  }

  // Tap en una celda de la vista Mes/Semana: cambia el día y vuelve a la
  // vista Día (estilo Google Calendar — el detalle siempre se ve en Día).
  function selectDayAndDrill(dateISO: string) {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setSelectedDate(dateISO);
    setActiveView('Día');
  }

  function changeView(v: CalView) {
    if (v === activeView) return;
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    setActiveView(v);
  }

  function openCreate() {
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSheet(true);
  }

  function goToNova() {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    router.push('/(tabs)/nova');
  }

  // CTA "Trabajar enfocado" en empty card → abre Nova con prompt prellenado
  // sobre bloquear tiempo enfocado para el día seleccionado.
  function goToNovaFocusSeed() {
    const today = isToday(selectedDate);
    setNovaSeed(
      today
        ? 'Reserva 2h enfocadas hoy y elimina distracciones.'
        : `Planifica un bloque enfocado para el ${selectedDate}.`,
    );
    goToNova();
  }

  const handleDeleteEvent = useCallback(
    (id: string, title: string) => {
      Alert.alert('¿Eliminar evento?', title, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void events.removeEvent(id) },
      ]);
    },
    [events],
  );

  const showLoading = events.loading && events.events.length === 0;
  const hasEvents = eventsForSelectedDay.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <AmbientNova scheme={scheme} level="low" />
      {showLoading ? (
        <LoadingState />
      ) : (
        <SwipeNavigator currentTab="calendar">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            directionalLockEnabled
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={events.refreshing}
                onRefresh={() => void events.refresh()}
                tintColor={c.text}
              />
            }
          >
            {/* ── Header: eyebrow mes + título ─────────────────────────── */}
            <View style={styles.header}>
              <Text style={[styles.eyebrow, { color: c.primary }]}>{monthLabel}</Text>
              <Text style={[styles.title, { color: c.text }]}>Calendario</Text>
            </View>

            {/* ── Toggle Día / Semana / Mes + botón añadir ─────────────── */}
            <View style={styles.toggleRow}>
              <View style={[styles.togglePills, { backgroundColor: c.surfaceMuted }]}>
                {VIEWS.map((v) => {
                  const isActive = v === activeView;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => changeView(v)}
                      hitSlop={6}
                      style={({ pressed }) => [
                        styles.pill,
                        isActive
                          ? { backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }
                          : null,
                        !isActive && pressed ? { opacity: 0.7 } : null,
                        pressed ? { transform: [{ scale: 0.985 }] } : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          { color: isActive ? c.text : c.textSubtle },
                          isActive ? { fontWeight: '700' } : { fontWeight: '500' },
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Botón + para añadir evento sin entrar al empty state */}
              <Pressable
                onPress={openCreate}
                style={({ pressed }) => [
                  styles.addBtn,
                  {
                    backgroundColor: pressed ? c.primaryPressed : c.primary,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Añadir evento"
              >
                <IconSymbol name="plus" size={16} color={c.onPrimary} weight="semibold" />
              </Pressable>
            </View>

            {events.error ? (
              <View style={styles.bannerWrap}>
                <ErrorBanner message="No pudimos cargar tus eventos." onRetry={() => void events.refresh()} />
              </View>
            ) : null}

            {/* ── Vista Día: selector semanal + timeline / empty ─────────── */}
            {activeView === 'Día' ? (
              <>
                <DayPicker
                  selectedDate={selectedDate}
                  onSelect={selectDay}
                  eventCounts={eventCounts}
                />

                {hasEvents ? (
                  <DayTimeline
                    dateISO={selectedDate}
                    events={eventsForSelectedDay}
                    onDeleteEvent={handleDeleteEvent}
                  />
                ) : events.error ? null : (
                  <View style={styles.emptyWrap}>
                    <EmptyAgendaState
                      selectedDate={selectedDate}
                      onCreateEvent={openCreate}
                      onFocusWork={goToNovaFocusSeed}
                    />
                  </View>
                )}
              </>
            ) : null}

            {/* ── Vista Semana: lista de los 7 días con eventos resumidos ── */}
            {activeView === 'Semana' ? (
              <WeekView
                selectedDate={selectedDate}
                events={events.events}
                onSelectDay={selectDayAndDrill}
                onChangeWeek={setSelectedDate}
              />
            ) : null}

            {/* ── Vista Mes: grilla 6×7 con puntos por día ──────────────── */}
            {activeView === 'Mes' ? (
              <MonthView
                selectedDate={selectedDate}
                eventCounts={eventCounts}
                onSelectDay={selectDayAndDrill}
                onChangeMonth={setSelectedDate}
              />
            ) : null}
          </ScrollView>

          <NovaInputBar
            context={{ type: 'calendar', selectedDate }}
            events={events.events}
            tasks={tasks.tasks}
            onAddEvent={events.addEvent}
            onAddTask={tasks.addTask}
            onRemoveEvent={events.removeEvent}
            onRemoveTask={tasks.removeTask}
            onRefresh={() => {
              void events.refresh();
              void tasks.refresh();
            }}
          />
        </KeyboardAvoidingView>
        </SwipeNavigator>
      )}

      <CreateEventSheet
        visible={showSheet}
        onDismiss={() => setShowSheet(false)}
        defaultDate={selectedDate}
        onSubmit={async (input) => {
          const created = await events.addEvent(input);
          return !!created;
        }}
      />
    </SafeAreaView>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyAgendaState({
  selectedDate,
  onCreateEvent,
  onFocusWork,
}: {
  selectedDate: string;
  onCreateEvent: () => void;
  onFocusWork: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const isCurrentDay = isToday(selectedDate);
  const isTomorrow = selectedDate === addDaysISO(todayISO(), 1);
  const title = isCurrentDay
    ? 'Día libre. Todo tuyo.'
    : isTomorrow
      ? 'Mañana sin compromisos.'
      : 'Espacio en blanco.';
  const desc = isCurrentDay
    ? 'Bloquea tu atención, agenda algo o describe abajo qué quieres hacer.'
    : isTomorrow
      ? 'Aprovecha para reservar bloques enfocados antes de que se llene.'
      : 'Sin eventos este día. Pídele a Nova que arme un bloque o agéndalo manual.';

  // Mismo lenguaje visual que EmptyDayState (Mi Día): card translúcida con
  // gradient brand violeta→azul→cyan y suggestion rows con icono gradient en
  // la acción primaria. Ahora todas las pantallas vacías cuentan la misma
  // historia visual.
  return (
    <View style={styles.emptyWrapInner}>
      {/* Resumen ejecutivo glass + gradient brand */}
      <GeminiSurface>
        <View style={styles.summaryPad}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryDot} />
            <Text style={[styles.summaryLabel, { color: c.textMuted }]}>AGENDA</Text>
          </View>
          <Text style={[styles.summaryTitle, { color: c.text }]}>{title}</Text>
          <Text style={[styles.summaryInsight, { color: c.textMuted }]}>{desc}</Text>
        </View>
      </GeminiSurface>

      {/* Sugerencias proactivas — primer chip con icon gradient brand,
          el resto translúcidos (mismo patrón que EmptyDayState). */}
      <View style={styles.suggestionsCol}>
        <Pressable
          onPress={onCreateEvent}
          style={({ pressed }) => [
            styles.suggestionShadow,
            {
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Añadir evento"
        >
          <View
            style={[
              styles.suggestion,
              {
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                borderColor: c.border,
              },
            ]}
          >
            <LinearGradient
              colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.suggestionIcon}
            >
              <IconSymbol name="plus" size={14} color="#ffffff" />
            </LinearGradient>
            <Text style={[styles.suggestionTitle, { color: c.text }]} numberOfLines={1}>
              Añadir evento
            </Text>
            <IconSymbol name="chevron.right" size={13} color={c.textSubtle} />
          </View>
        </Pressable>

        <Pressable
          onPress={onFocusWork}
          style={({ pressed }) => [
            styles.suggestionShadow,
            {
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Trabajar enfocado"
        >
          <View
            style={[
              styles.suggestion,
              {
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                borderColor: c.border,
              },
            ]}
          >
            <View style={[styles.suggestionIconMuted, { backgroundColor: c.primaryContainer }]}>
              <IconSymbol name="scope" size={14} color={c.primary} />
            </View>
            <Text style={[styles.suggestionTitle, { color: c.text }]} numberOfLines={1}>
              Trabajar enfocado
            </Text>
            <IconSymbol name="chevron.right" size={13} color={c.textSubtle} />
          </View>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert('Próximamente', 'La importación de agendas externas estará disponible pronto.')
          }
          style={({ pressed }) => [
            styles.suggestionShadow,
            {
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Importar agenda"
        >
          <View
            style={[
              styles.suggestion,
              {
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.6)',
                borderColor: c.border,
              },
            ]}
          >
            <View style={[styles.suggestionIconMuted, { backgroundColor: c.primaryContainer }]}>
              <IconSymbol name="square.and.arrow.down" size={14} color={c.primary} />
            </View>
            <Text style={[styles.suggestionTitle, { color: c.text }]} numberOfLines={1}>
              Importar agenda
            </Text>
            <IconSymbol name="chevron.right" size={13} color={c.textSubtle} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  scrollContent: {
    paddingBottom: 16,
    gap: Spacing.lg,
  },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: 3,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: 0.1,
    textTransform: 'capitalize',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.7,
  },

  // Toggle Día/Semana/Mes
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  togglePills: {
    flexDirection: 'row',
    gap: 4,
    // backgroundColor se setea inline desde el theme (c.surfaceMuted) para
    // que respete dark mode. Antes estaba hardcodeado a '#f1f5f9' y
    // chocaba con el resto del UI en oscuro.
    borderRadius: Radius.full,
    padding: 3,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 17,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bannerWrap: { paddingHorizontal: Spacing.lg },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
  },

  // Wrapper interno del empty state nuevo: stack vertical de
  // GeminiSurface (resumen) + 3 suggestion rows con misma anchura.
  emptyWrapInner: {
    gap: Spacing.lg,
  },
  // Padding interno cuando un GeminiSurface envuelve el "resumen".
  // No se aplica al GeminiSurface en sí porque el componente es agnóstico
  // del padding (ver doc en GeminiSurface.tsx).
  summaryPad: {
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 14,
    gap: 4,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#8b5cf6',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  summaryInsight: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '400',
    marginTop: 2,
  },

  // Suggestions — mismo patrón que EmptyDayState. Primer chip se diferencia
  // por el icon en LinearGradient brand; los demás van con icon muted.
  suggestionsCol: {
    gap: 8,
  },
  suggestionShadow: {
    borderRadius: 14,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestion: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    borderWidth: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconMuted: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    flex: 1,
  },
});
