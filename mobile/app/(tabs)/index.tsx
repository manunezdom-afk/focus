import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { EventRow } from '@/components/EventRow';
import { LoadingState } from '@/components/LoadingState';
import { SectionHeader } from '@/components/SectionHeader';
import { TaskRow } from '@/components/TaskRow';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayLabelLong } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Capitaliza la primera letra ("lunes 4 de marzo" → "Lunes 4 de marzo")
function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

export default function MiDiaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const events = useEvents('today');
  const tasks = useTasks();

  const dateLabel = useMemo(() => capitalize(todayLabelLong()), []);

  // Tareas pendientes (no done) primero — la query ya las trae ordenadas por
  // `done ASC, created_at DESC`. Para Mi Día filtramos a pending y mostramos
  // las primeras 8 (las completadas hoy van a Tareas, no a Mi Día).
  const pendingTasks = useMemo(() => {
    return tasks.tasks.filter((t) => !t.done).slice(0, 8);
  }, [tasks.tasks]);

  const loading = (events.loading && events.events.length === 0) || (tasks.loading && tasks.tasks.length === 0);
  const refreshing = events.refreshing || tasks.refreshing;
  const error = events.error || tasks.error;

  function handleRefresh() {
    void events.refresh();
    void tasks.refresh();
  }

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
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Mi día</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>{dateLabel}</Text>
        </View>

        {error ? <ErrorBanner message="No pudimos cargar tus datos." onRetry={handleRefresh} /> : null}

        {loading ? (
          <LoadingState />
        ) : (
          <>
            <SectionHeader title="Eventos de hoy" count={events.events.length} />
            {events.events.length === 0 ? (
              <EmptyState
                title="Sin eventos hoy"
                description="Los eventos creados desde la web o Nova aparecen aquí."
              />
            ) : (
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
                {events.events.map((evt) => (
                  <EventRow key={evt.id} event={evt} />
                ))}
              </View>
            )}

            <SectionHeader title="Tareas pendientes" count={pendingTasks.length} />
            {pendingTasks.length === 0 ? (
              <EmptyState
                title="Todo en orden"
                description="No tienes tareas pendientes. Crea nuevas desde la pestaña Tareas."
              />
            ) : (
              <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
                {pendingTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={tasks.toggleTask}
                    onDelete={tasks.removeTask}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, lineHeight: 21 },
  list: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
