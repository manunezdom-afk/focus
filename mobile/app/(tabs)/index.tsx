import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { EventRow } from '@/components/EventRow';
import { LoadingState } from '@/components/LoadingState';
import { SectionHeader } from '@/components/SectionHeader';
import { TaskRow } from '@/components/TaskRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayLabelLong } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Capitaliza la primera letra ("lunes 4 de marzo" → "Lunes 4 de marzo")
function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

// Saludo según hora local. Mismo patrón que la web.
function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function MiDiaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const events = useEvents('today');
  const tasks = useTasks();

  const dateLabel = useMemo(() => capitalize(todayLabelLong()), []);
  const hello = useMemo(() => greeting(), []);

  // Tareas pendientes (no done) primero — la query ya las trae ordenadas.
  // Para Mi Día filtramos a pending y mostramos las primeras 8.
  const pendingTasks = useMemo(() => {
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
        {/* Header con saludo + fecha */}
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: c.textMuted }]}>{hello}</Text>
          <Text style={[styles.title, { color: c.text }]}>Mi día</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>{dateLabel}</Text>
        </View>

        {/* Tarjeta CTA Nova — entrada al asistente */}
        <Pressable
          onPress={() => router.push('/nova')}
          style={({ pressed }) => [
            styles.novaCard,
            {
              backgroundColor: c.surfaceTint,
              borderColor: c.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Abrir Nova"
        >
          <View
            style={[
              styles.novaIcon,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <IconSymbol name="sparkles" size={20} color={c.primary} />
          </View>
          <View style={styles.novaText}>
            <Text style={[styles.novaTitle, { color: c.text }]}>Pregúntale a Nova</Text>
            <Text style={[styles.novaDesc, { color: c.textMuted }]}>
              Organiza tu día, crea tareas o eventos hablando.
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color={c.textSubtle} />
        </Pressable>

        {error ? (
          <ErrorBanner message="No pudimos cargar tus datos." onRetry={handleRefresh} />
        ) : null}

        {loading ? (
          <LoadingState />
        ) : (
          <>
            {/* Eventos de hoy */}
            <SectionHeader title="Eventos de hoy" count={events.events.length} />
            {events.events.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="Sin eventos hoy"
                description="Disfruta el día con calma — o crea uno desde el calendario."
              />
            ) : (
              <View
                style={[
                  styles.list,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
                {events.events.map((evt) => (
                  <EventRow key={evt.id} event={evt} />
                ))}
              </View>
            )}

            {/* Tareas pendientes */}
            <SectionHeader title="Tareas pendientes" count={pendingTasks.length} />
            {pendingTasks.length === 0 ? (
              <EmptyState
                icon="checklist"
                title={totalDoneToday > 0 ? '¡Listo por hoy!' : 'Todo en orden'}
                description={
                  totalDoneToday > 0
                    ? `Completaste ${totalDoneToday} tarea${totalDoneToday === 1 ? '' : 's'} hoy.`
                    : 'Crea nuevas desde la pestaña Tareas.'
                }
              />
            ) : (
              <View
                style={[
                  styles.list,
                  { backgroundColor: c.surface, borderColor: c.border },
                ]}
              >
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

            {/* Resumen de progreso al final, sutil */}
            {totalDoneToday > 0 && pendingTasks.length > 0 ? (
              <View style={[styles.progressNote, { backgroundColor: c.surfaceTint }]}>
                <IconSymbol name="checklist" size={14} color={c.primary} />
                <Text style={[styles.progressText, { color: c.text }]}>
                  Hoy completaste {totalDoneToday} tarea{totalDoneToday === 1 ? '' : 's'}.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    gap: 2,
  },
  greeting: {
    ...Typography.caption,
    fontWeight: '600',
  },
  title: { ...Typography.display, marginTop: 2 },
  subtitle: { ...Typography.body, marginTop: 2 },

  novaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  novaIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  novaText: { flex: 1, gap: 2 },
  novaTitle: { ...Typography.bodyStrong },
  novaDesc: { ...Typography.caption },

  list: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  progressNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  progressText: { ...Typography.caption, fontWeight: '600' },
});
