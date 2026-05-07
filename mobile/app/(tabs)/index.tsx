import { router } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/ErrorBanner';
import { EventRow } from '@/components/EventRow';
import { LoadingState } from '@/components/LoadingState';
import { NovaInputPill } from '@/components/NovaInputPill';
import { SuggestionChip } from '@/components/SuggestionChip';
import { TaskRow } from '@/components/TaskRow';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayLabelLong } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Eyebrow tipo "JUEVES, 7 DE MAYO" derivado de todayLabelLong
// ("jueves 7 de mayo" → comma after weekday + uppercase). Mantiene la
// misma fuente de verdad de fecha que el resto de la app.
function todayEyebrow(): string {
  const label = todayLabelLong(); // "jueves 7 de mayo"
  return label.replace(/^(\S+) /, '$1, ').toUpperCase();
}

export default function MiDiaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const events = useEvents('today');
  const tasks = useTasks();

  const eyebrow = useMemo(() => todayEyebrow(), []);

  const pendingTasks = useMemo(() => {
    const today = tasks.tasks.filter((t) => !t.done && (t.category === 'hoy' || !t.category));
    if (today.length > 0) return today.slice(0, 8);
    return tasks.tasks.filter((t) => !t.done).slice(0, 8);
  }, [tasks.tasks]);

  const totalDoneToday = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();
    return tasks.tasks.filter((t) => t.done && t.doneAt && t.doneAt >= startMs).length;
  }, [tasks.tasks]);

  const loading =
    (events.loading && events.events.length === 0) ||
    (tasks.loading && tasks.tasks.length === 0);
  const refreshing = events.refreshing || tasks.refreshing;
  const error = events.error || tasks.error;

  function handleRefresh() {
    void events.refresh();
    void tasks.refresh();
  }

  function goToNova(prompt?: string) {
    router.push(
      prompt
        ? { pathname: '/(tabs)/nova', params: { prompt } }
        : '/(tabs)/nova',
    );
  }

  const hasAnyItem = events.events.length > 0 || pendingTasks.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={c.text}
          />
        }
      >
        <ScreenHeader eyebrow={eyebrow} title="Mi Día" />

        {/* Pill de entrada a Nova — la pieza protagonista del header. */}
        <View style={styles.pillWrap}>
          <NovaInputPill onPress={() => goToNova()} />
        </View>

        {error ? (
          <View style={styles.bannerWrap}>
            <ErrorBanner message="No pudimos cargar tus datos." onRetry={handleRefresh} />
          </View>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : !hasAnyItem ? (
          <EmptyToday onPick={(prompt) => goToNova(prompt)} c={c} />
        ) : (
          <>
            <SectionLabel label="Eventos de hoy" count={events.events.length} />
            {events.events.length === 0 ? null : (
              <View style={styles.cardWrap}>
                <Card variant="default">
                  {events.events.map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </Card>
              </View>
            )}

            <SectionLabel label="Tareas pendientes" count={pendingTasks.length} />
            {pendingTasks.length === 0 ? (
              <View style={styles.miniEmpty}>
                <Text style={[styles.miniEmptyText, { color: c.textMuted }]}>
                  {totalDoneToday > 0
                    ? `Completaste ${totalDoneToday} tarea${totalDoneToday === 1 ? '' : 's'} hoy.`
                    : 'No tienes tareas pendientes.'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardWrap}>
                <Card variant="default">
                  {pendingTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={tasks.toggleTask}
                      onDelete={tasks.removeTask}
                    />
                  ))}
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Empty state "Hoy está libre" con 3 chips de prompts para Nova.
// Los chips son CTA — al tocarlos abrimos Nova con ese prompt prellenado.
// NO son eventos ni tareas reales: son ejemplos para dispararle al chat.
function EmptyToday({
  onPick,
  c,
}: {
  onPick: (prompt: string) => void;
  c: typeof Colors.light;
}) {
  return (
    <View style={emptyStyles.box}>
      <Text style={[emptyStyles.title, { color: c.text }]}>Hoy está libre.</Text>
      <Text style={[emptyStyles.desc, { color: c.textMuted }]}>
        ¿Por dónde empezamos? Toca un ejemplo o escríbele a Nova.
      </Text>

      <View style={emptyStyles.chips}>
        <SuggestionChip
          iconName="dumbbell.fill"
          label="Agendar gym mañana"
          onPress={() => onPick('Agéndame gym mañana a primera hora.')}
        />
        <SuggestionChip
          iconName="clock.fill"
          label="Reservar 2h enfocadas"
          onPress={() => onPick('Resérvame 2 horas de trabajo enfocado hoy.')}
        />
        <SuggestionChip
          iconName="calendar"
          label="Reunión semanal fija"
          onPress={() =>
            onPick('Crea una reunión semanal fija. Pregúntame día y hora.')
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },

  pillWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.lg,
  },

  bannerWrap: { paddingHorizontal: Spacing.lg },
  cardWrap: { paddingHorizontal: Spacing.lg },
  miniEmpty: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  miniEmptyText: { ...Typography.body, fontSize: 14 },
});

const emptyStyles = StyleSheet.create({
  box: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['2xl'],
    gap: Spacing.md,
    alignItems: 'stretch',
  },
  title: {
    ...Typography.title2,
    textAlign: 'center',
  },
  desc: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  chips: {
    gap: Spacing.sm,
  },
});
