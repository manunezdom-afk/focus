import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { EmptyDayState } from '@/components/planner/EmptyDayState';
import { NextBlockCard } from '@/components/planner/NextBlockCard';
import { PlannerNovaInput, type PlannerNovaSeed } from '@/components/planner/PlannerNovaInput';
import { TimelineEventBlock } from '@/components/planner/TimelineEventBlock';
import { TimelineTaskBlock } from '@/components/planner/TimelineTaskBlock';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayLabelLong } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// "HH:MM" o "HH:MM-HH:MM" → decimal (14.5 = 14:30). Sin hora → Infinity
// para que vaya al final del timeline.
function timeToH(time: string): number {
  const m = time?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return Infinity;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
}

export default function MiDiaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const events = useEvents('today');
  const tasks = useTasks();

  const dateLabel = useMemo(() => todayLabelLong(), []);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 'Buenas noches';
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  // Done state local — efímero. Se pierde al cambiar de tab. Cuando exista
  // schema en Supabase para "block.type=done" se persiste.
  const [doneEventIds, setDoneEventIds] = useState<Set<string>>(() => new Set());
  const toggleEventDone = useCallback((id: string) => {
    setDoneEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Seed para el FocusBar — cada chip del empty state incrementa `n`.
  const [novaSeed, setNovaSeed] = useState<PlannerNovaSeed>({ text: '', n: 0 });
  const seedNova = useCallback((text: string) => {
    setNovaSeed((s) => ({ text, n: s.n + 1 }));
  }, []);

  const sortedEvents = useMemo(
    () => [...events.events].sort((a, b) => timeToH(a.time) - timeToH(b.time)),
    [events.events],
  );

  const nowH = (() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  })();

  // Tareas que aparecen en Mi Día: solo `category === 'hoy'` o sin
  // categoría. Mismo criterio que el legacy. Máx 8 para no saturar.
  const pendingTasks = useMemo(
    () =>
      tasks.tasks
        .filter((t) => !t.done && (t.category === 'hoy' || !t.category))
        .slice(0, 8),
    [tasks.tasks],
  );

  const loading =
    (events.loading && events.events.length === 0) ||
    (tasks.loading && tasks.tasks.length === 0);
  const refreshing = events.refreshing || tasks.refreshing;
  const error = events.error || tasks.error;

  const handleRefresh = useCallback(() => {
    void events.refresh();
    void tasks.refresh();
  }, [events, tasks]);

  const handleDeleteEvent = useCallback(
    (id: string, title: string) => {
      Alert.alert('¿Eliminar evento?', title, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void events.removeEvent(id),
        },
      ]);
    },
    [events],
  );

  const handleDeleteTask = useCallback(
    (id: string, label: string) => {
      Alert.alert('¿Eliminar tarea?', label, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void tasks.removeTask(id),
        },
      ]);
    },
    [tasks],
  );

  const hasAnyItem = events.events.length > 0 || pendingTasks.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.text}
            />
          }
        >
          {/* ── Header AI-native ──────────────────────────────────────
              Título grande primero, saludo + fecha como subtítulo
              cálido. Mantiene la estructura legacy (título + línea de
              contexto) pero con jerarquía y tono más Gemini-style:
              menos rígido, más respirado. */}
          <View style={styles.header}>
            <Text style={[styles.titleLine, { color: c.text }]}>Mi día</Text>
            <Text style={[styles.subLine, { color: c.primary }]} numberOfLines={1}>
              <Text style={styles.subLineStrong}>{greeting}</Text>
              <Text style={{ color: c.textMuted }}>{`  ·  ${dateLabel}`}</Text>
            </Text>
          </View>

          {/* FocusBar inline — paradigma legacy: lenguaje natural a Nova */}
          <PlannerNovaInput
            events={events.events}
            tasks={tasks.tasks}
            onAddEvent={events.addEvent}
            onAddTask={tasks.addTask}
            onRefresh={handleRefresh}
            seed={novaSeed}
          />

          {error ? (
            <View style={styles.bannerWrap}>
              <ErrorBanner
                message="No pudimos cargar tus datos."
                onRetry={handleRefresh}
              />
            </View>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : !hasAnyItem ? (
            <EmptyDayState onPickPrompt={seedNova} />
          ) : (
            <>
              {/* Timeline: eventos por hora + tareas hoy al final */}
              <View style={styles.timelineWrap}>
                {sortedEvents.map((evt) => (
                  <TimelineEventBlock
                    key={evt.id}
                    event={evt}
                    isPast={timeToH(evt.time) < nowH}
                    done={doneEventIds.has(evt.id)}
                    onToggleDone={() => toggleEventDone(evt.id)}
                    onDeletePress={() => handleDeleteEvent(evt.id, evt.title)}
                  />
                ))}
                {pendingTasks.map((t) => (
                  <TimelineTaskBlock
                    key={t.id}
                    task={t}
                    onToggle={tasks.toggleTask}
                    onDeletePress={() => handleDeleteTask(t.id, t.label)}
                  />
                ))}
              </View>

              {/* Próximo Bloque / En Curso — orientación temporal del día */}
              <NextBlockCard events={events.events} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  // 48px asegura que el último bloque del timeline no quede oculto detrás
  // del CustomTabBar (que tiene su propia safe area). Sin este margen, el
  // botón "HECHO ✓" del último item podía quedar parcialmente cubierto.
  scrollContent: { paddingBottom: 48 },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['2xl'],
    gap: 6,
  },
  titleLine: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  subLine: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },
  subLineStrong: {
    fontWeight: '700',
  },

  bannerWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  timelineWrap: { paddingTop: Spacing.sm },
});
