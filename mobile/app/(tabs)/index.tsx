import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
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
import { TaskRow } from '@/components/TaskRow';
import { TodayEventRow } from '@/components/TodayEventRow';
import { Card } from '@/components/ui/Card';
import { FocusBar } from '@/components/ui/FocusBar';
import { NextBlockCard } from '@/components/ui/NextBlockCard';
import { NovaPromptCard } from '@/components/ui/NovaPromptCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { dateEyebrow, timeUntil } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Devuelve el siguiente evento futuro hoy, o null si no hay.
function findNextEvent(events: EventItem[], now: Date): EventItem | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const ev of events) {
    if (!ev.time) continue;
    const m = ev.time.replace(/\s/g, '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    if (startMin > nowMin) return ev;
  }
  return null;
}

function getStartTime(time: string): string {
  const m = time.replace(/\s/g, '').match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : '';
}

export default function MiDiaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const events = useEvents('today');
  const tasks = useTasks();

  // Tick para refrescar countdown del Próximo Bloque cada minuto sin hacer
  // setState costoso. Re-render via tick state — más simple que useReducer.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const eyebrow = useMemo(() => dateEyebrow(), []);

  // Pendientes: si tiene category 'hoy', priorizamos. Si no, top 8 sin done.
  const pendingTasks = useMemo(() => {
    const today = tasks.tasks.filter(
      (t) => !t.done && (t.category === 'hoy' || !t.category),
    );
    if (today.length > 0) return today.slice(0, 8);
    return tasks.tasks.filter((t) => !t.done).slice(0, 8);
  }, [tasks.tasks]);

  // Eventos ordenados por hora (la query ya viene ordenada, pero aseguramos
  // por si llegan items sin tiempo arriba).
  const sortedEvents = useMemo(() => {
    return [...events.events].sort((a, b) => {
      const aT = getStartTime(a.time) || 'zz';
      const bT = getStartTime(b.time) || 'zz';
      return aT.localeCompare(bT);
    });
  }, [events.events]);

  const nextEvent = useMemo(() => findNextEvent(sortedEvents, new Date()), [sortedEvents]);
  const nextCountdown = useMemo(
    () => (nextEvent ? timeUntil(getStartTime(nextEvent.time)) : null),
    [nextEvent],
  );

  const loading =
    (events.loading && events.events.length === 0) ||
    (tasks.loading && tasks.tasks.length === 0);
  const refreshing = events.refreshing || tasks.refreshing;
  const error = events.error || tasks.error;

  function handleRefresh() {
    void events.refresh();
    void tasks.refresh();
  }

  // Cuando el usuario manda algo desde el FocusBar, navegamos a Nova con
  // el seed pre-rellenado y autosubmit. Nova se encarga del flujo.
  function handleFocusSubmit(text: string) {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push({
      pathname: '/nova',
      params: { seed: text, autosubmit: '1' },
    });
  }

  // Action sheet del botón "Añadir": tarea / evento / pedirle a Nova.
  function openAddSheet() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Añadir',
          options: ['Pedirle a Nova', 'Crear evento', 'Crear tarea', 'Cancelar'],
          cancelButtonIndex: 3,
          userInterfaceStyle: scheme,
        },
        (idx) => {
          if (idx === 0) router.push('/nova');
          else if (idx === 1) router.push('/calendar');
          else if (idx === 2) router.push('/tasks');
        },
      );
    } else {
      Alert.alert('Añadir', '¿Qué quieres crear?', [
        { text: 'Pedirle a Nova', onPress: () => router.push('/nova') },
        { text: 'Evento', onPress: () => router.push('/calendar') },
        { text: 'Tarea', onPress: () => router.push('/tasks') },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  }

  const hasAnyItem = sortedEvents.length > 0 || pendingTasks.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
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
          {/* Header — eyebrow date caps + título Mi Día + descripción */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={[styles.eyebrow, { color: c.primary }]}>{eyebrow}</Text>
                <Text style={[styles.title, { color: c.text }]}>Mi Día</Text>
              </View>
              <PrimaryButton label="Añadir" size="sm" onPress={openAddSheet} />
            </View>
            <Text style={[styles.description, { color: c.textMuted }]}>
              Captura cualquier cosa en lenguaje natural. Nova lo convierte en
              agenda, tareas y recordatorios.
            </Text>
          </View>

          {/* FocusBar — centro de la pantalla */}
          <View style={styles.focusBarWrap}>
            <FocusBar onSubmit={handleFocusSubmit} />
          </View>

          {/* Próximo Bloque */}
          {nextEvent ? (
            <View style={styles.cardWrap}>
              <NextBlockCard
                title={nextEvent.title}
                startTime={getStartTime(nextEvent.time)}
                countdown={nextCountdown}
              />
            </View>
          ) : null}

          {/* Errors */}
          {error ? (
            <View style={styles.cardWrap}>
              <ErrorBanner
                message="No pudimos cargar tus datos."
                onRetry={handleRefresh}
              />
            </View>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : !hasAnyItem ? (
            // Empty state legacy: NovaPromptCard + grid 2x2 quick actions.
            // Las acciones reales están en el FocusBar de arriba; aquí
            // mantenemos el patrón legacy para los onboarding empty states.
            <View style={styles.emptyWrap}>
              <NovaPromptCard
                title="Tu agenda de hoy está vacía."
                description="Dile a Nova qué tienes hoy, o añade algo tú mismo."
              />
            </View>
          ) : (
            <>
              {/* Eventos timeline — sin SectionLabel cuando hay NextBlockCard
                  arriba para no duplicar. */}
              {sortedEvents.length > 0 ? (
                <>
                  <SectionLabel label="Hoy" count={sortedEvents.length} />
                  <View style={styles.timelineWrap}>
                    {sortedEvents.map((evt, idx) => (
                      <TodayEventRow
                        key={evt.id}
                        event={evt}
                        isLast={idx === sortedEvents.length - 1}
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {/* Tareas pendientes */}
              {pendingTasks.length > 0 ? (
                <>
                  <SectionLabel label="Pendientes" count={pendingTasks.length} />
                  <View style={styles.cardWrap}>
                    <Card variant="default">
                      {pendingTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onToggle={tasks.toggleTask}
                          onDelete={tasks.removeTask}
                          showPriority={false}
                        />
                      ))}
                    </Card>
                  </View>
                </>
              ) : null}
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
  scrollContent: { paddingBottom: Spacing['3xl'] + 60 },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
    letterSpacing: -0.6,
  },
  description: {
    ...Typography.body,
    lineHeight: 21,
    marginTop: 4,
  },

  focusBarWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },

  cardWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },

  timelineWrap: {
    paddingHorizontal: Spacing.lg + 4,
    paddingBottom: Spacing.md,
  },
});
