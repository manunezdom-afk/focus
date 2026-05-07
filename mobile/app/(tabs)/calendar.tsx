import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateEventSheet } from '@/components/CreateEventSheet';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { DayPicker } from '@/components/calendar/DayPicker';
import { DayTimeline } from '@/components/calendar/DayTimeline';
import { SmartDaySummary } from '@/components/calendar/SmartDaySummary';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday, todayISO } from '@/src/data/today';
import type { Task } from '@/src/data/types';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

function dayLabelLong(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return dateISO;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt).replace(',', '');
}

function selectedDaySubject(dateISO: string): string {
  if (isToday(dateISO)) return 'Hoy';
  if (dateISO === addDaysISO(todayISO(), 1)) return 'Mañana';
  return `El ${dayLabelLong(dateISO)}`;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildHeaderSubtitle(dateISO: string, eventCount: number, taskCount: number): string {
  const subject = selectedDaySubject(dateISO);
  if (eventCount === 0 && taskCount === 0) {
    return `${subject} tienes espacio libre para planificar con calma.`;
  }
  if (eventCount === 0) {
    return `${subject} no tienes eventos y hay ${countLabel(taskCount, 'tarea pendiente', 'tareas pendientes')}.`;
  }
  if (taskCount === 0) {
    return `${subject} tienes ${countLabel(eventCount, 'evento', 'eventos')} en agenda.`;
  }
  return `${subject} tienes ${countLabel(eventCount, 'evento', 'eventos')} y ${countLabel(taskCount, 'tarea pendiente', 'tareas pendientes')}.`;
}

function relevantPendingTasks(tasks: Task[], dateISO: string): Task[] {
  if (!isToday(dateISO)) return [];
  const todayTasks = tasks.filter((task) => !task.done && (task.category === 'hoy' || !task.category));
  if (todayTasks.length > 0) return todayTasks;
  return tasks.filter((task) => !task.done);
}

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const events = useEvents('all');
  const tasks = useTasks();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [showSheet, setShowSheet] = useState(false);

  // Mapa fecha → cantidad de eventos. Se usa para mostrar los puntos en
  // los chips del DayPicker. Un único pase O(n) sobre el array completo.
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

  function selectDay(dateISO: string) {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    setSelectedDate(dateISO);
  }

  function openCreate() {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowSheet(true);
  }

  function goToNova() {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    router.push('/(tabs)/nova');
  }

  function handleRefresh() {
    void events.refresh();
    void tasks.refresh();
  }

  const pendingTasksForDay = useMemo(
    () => relevantPendingTasks(tasks.tasks, selectedDate),
    [tasks.tasks, selectedDate],
  );

  const taskPreview = useMemo(() => pendingTasksForDay.slice(0, 3), [pendingTasksForDay]);

  const showLoading =
    events.loading &&
    events.events.length === 0 &&
    (tasks.loading || tasks.tasks.length === 0);
  const refreshing = events.refreshing || tasks.refreshing;
  const error = events.error || tasks.error;
  const subtitle = buildHeaderSubtitle(
    selectedDate,
    eventsForSelectedDay.length,
    pendingTasksForDay.length,
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {showLoading ? (
        <LoadingState />
      ) : (
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
          <ScreenHeader
            eyebrow="Calendario"
            title="Tu agenda"
            subtitle={subtitle}
            rightAction={<AddHeaderButton onPress={openCreate} />}
          />

          {error ? (
            <View style={styles.bannerWrap}>
              <ErrorBanner
                message="No pudimos cargar todos tus datos."
                onRetry={handleRefresh}
              />
            </View>
          ) : null}

          <DayPicker
            selectedDate={selectedDate}
            onSelect={selectDay}
            eventCounts={eventCounts}
          />

          <View style={styles.summaryWrap}>
            <SmartDaySummary
              dateISO={selectedDate}
              events={eventsForSelectedDay}
              pendingTasksCount={pendingTasksForDay.length}
              onPlanWithNova={goToNova}
            />
          </View>

          {eventsForSelectedDay.length > 0 ? (
            <DayTimeline dateISO={selectedDate} events={eventsForSelectedDay} />
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyAgendaState
                selectedDate={selectedDate}
                onCreateEvent={openCreate}
                onAskNova={goToNova}
              />
            </View>
          )}

          {taskPreview.length > 0 ? (
            <RelatedTasksPreview tasks={taskPreview} total={pendingTasksForDay.length} />
          ) : null}
        </ScrollView>
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

function AddHeaderButton({ onPress }: { onPress: () => void }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.addButton,
        {
          backgroundColor: pressed ? c.primaryPressed : c.primary,
          shadowColor: c.primary,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Añadir evento"
    >
      <IconSymbol name="plus" size={17} color={c.onPrimary} />
      <Text style={[styles.addButtonText, { color: c.onPrimary }]}>Añadir</Text>
    </Pressable>
  );
}

function EmptyAgendaState({
  selectedDate,
  onCreateEvent,
  onAskNova,
}: {
  selectedDate: string;
  onCreateEvent: () => void;
  onAskNova: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const title = isToday(selectedDate)
    ? 'No tienes eventos para hoy.'
    : 'No tienes eventos para este día.';

  return (
    <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: c.surfaceTint, borderColor: c.border },
        ]}
      >
        <IconSymbol name="calendar" size={24} color={c.primary} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.emptyDescription, { color: c.textMuted }]}>
          Puedes crear un evento manualmente o pedirle a Nova que te ayude a planificar.
        </Text>
      </View>
      <View style={styles.emptyActions}>
        <Pressable
          onPress={onCreateEvent}
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Añadir evento"
        >
          <IconSymbol name="plus" size={17} color={c.onPrimary} />
          <Text style={[styles.primaryCtaText, { color: c.onPrimary }]}>Añadir evento</Text>
        </Pressable>
        <Pressable
          onPress={onAskNova}
          style={({ pressed }) => [
            styles.secondaryCta,
            {
              backgroundColor: pressed ? c.surfaceTint : c.surface,
              borderColor: c.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Pedirle a Nova"
        >
          <IconSymbol name="sparkles" size={17} color={c.primary} />
          <Text style={[styles.secondaryCtaText, { color: c.primary }]}>Pedirle a Nova</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RelatedTasksPreview({ tasks, total }: { tasks: Task[]; total: number }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.tasksWrap}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Tareas relacionadas</Text>
        <Text style={[styles.sectionCount, { color: c.textSubtle }]}>
          {countLabel(total, 'pendiente', 'pendientes')}
        </Text>
      </View>
      <View style={[styles.tasksCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        {tasks.map((task, index) => (
          <View
            key={task.id}
            style={[
              styles.taskRow,
              { borderBottomColor: c.border },
              index === tasks.length - 1 ? styles.taskLastRow : null,
            ]}
          >
            <View style={[styles.taskCheck, { borderColor: c.borderStrong }]} />
            <View style={styles.taskTextCol}>
              <Text style={[styles.taskTitle, { color: c.text }]} numberOfLines={2}>
                {task.label}
              </Text>
              <Text style={[styles.taskMeta, { color: c.textSubtle }]}>{task.priority}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bannerWrap: { paddingHorizontal: Spacing.lg },

  scrollContent: {
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
  },

  summaryWrap: {
    paddingHorizontal: Spacing.lg,
  },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  addButtonText: {
    ...Typography.caption,
    fontWeight: '800',
  },

  emptyCard: {
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    gap: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.title3,
    fontSize: 18,
    lineHeight: 24,
  },
  emptyDescription: {
    ...Typography.body,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryCta: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  primaryCtaText: {
    ...Typography.bodyStrong,
    fontSize: 14,
  },
  secondaryCta: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  secondaryCtaText: {
    ...Typography.bodyStrong,
    fontSize: 14,
  },

  tasksWrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...Typography.title3,
  },
  sectionCount: {
    ...Typography.caption,
    fontWeight: '700',
  },
  tasksCard: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskLastRow: {
    borderBottomWidth: 0,
  },
  taskCheck: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  taskTextCol: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    ...Typography.bodyStrong,
  },
  taskMeta: {
    ...Typography.micro,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
