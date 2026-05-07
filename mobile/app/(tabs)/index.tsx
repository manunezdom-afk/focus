import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { TaskRow } from '@/components/TaskRow';
import { Card } from '@/components/ui/Card';
import { NovaPromptCard } from '@/components/ui/NovaPromptCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { QuickActionButton } from '@/components/ui/QuickActionButton';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { TimelineEventBlock } from '@/components/planner/TimelineEventBlock';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayLabelLong } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Convierte "HH:MM" o "HH:MM - HH:MM" a valor decimal (14.5 = 14:30).
// Retorna Infinity si no hay hora (eventos sin hora van al final del timeline).
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

  // Eventos ordenados por hora ascendente; sin hora al final.
  const sortedEvents = useMemo(
    () => [...events.events].sort((a, b) => timeToH(a.time) - timeToH(b.time)),
    [events.events],
  );

  // Hora actual en decimal para marcar eventos pasados.
  const nowH = (() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  })();

  // Tareas pendientes hoy: category === 'hoy' tiene prioridad; si no hay,
  // se muestran todas las pendientes (máx 8). Mismo criterio que el legacy.
  const pendingTasks = useMemo(() => {
    const today = tasks.tasks.filter((t) => !t.done && (t.category === 'hoy' || !t.category));
    if (today.length > 0) return today.slice(0, 8);
    return tasks.tasks.filter((t) => !t.done).slice(0, 8);
  }, [tasks.tasks]);

  const totalDoneToday = useMemo(() => {
    const startMs = new Date().setHours(0, 0, 0, 0);
    return tasks.tasks.filter((t) => t.done && t.doneAt != null && t.doneAt >= startMs).length;
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

  const handleDeleteEvent = useCallback(
    (id: string, title: string) => {
      Alert.alert(
        '¿Eliminar evento?',
        title,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => void events.removeEvent(id),
          },
        ],
      );
    },
    [events],
  );

  const hasAnyItem = events.events.length > 0 || pendingTasks.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={c.text} />
        }
      >
        {/* ── Header legacy-style ──────────────────────────────────────────
            Línea 1: fecha completa en primary, uppercase, tracking.
            Línea 2: "Mi día" extrabold grande.
            Botón "Añadir" a la derecha (provisional hasta implementar FocusBar). */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.dateLine, { color: c.primary }]}>
                {dateLabel.toUpperCase()}
              </Text>
              <Text style={[styles.titleLine, { color: c.text }]}>Mi día</Text>
            </View>
            <View style={styles.headerBtn}>
              <PrimaryButton label="Añadir" size="sm" onPress={() => router.push('/calendar')} />
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.bannerWrap}>
            <ErrorBanner message="No pudimos cargar tus datos." onRetry={handleRefresh} />
          </View>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : !hasAnyItem ? (
          // Empty state: Nova card + 2 acciones principales.
          // Los botones deshabilitados (Dictar, Foto) se quitaron hasta implementarse.
          <View style={styles.emptyWrap}>
            <NovaPromptCard
              title="Tu agenda de hoy está vacía."
              description="Dile a Nova qué tienes hoy, o añade algo tú mismo."
            />
            <View style={styles.actionsRow}>
              <QuickActionButton
                label="Añadir"
                iconName="plus.circle.fill"
                onPress={() => router.push('/calendar')}
              />
              <QuickActionButton
                label="Hablar con Nova"
                iconName="sparkles"
                onPress={() => router.push('/nova')}
              />
            </View>
          </View>
        ) : (
          <>
            {/* ── Timeline de eventos ──────────────────────────────────────
                Columna hora 52px + dot conector + card con borde lateral.
                Eventos sin hora van al final (timeToH → Infinity). */}
            {sortedEvents.length === 0 ? (
              <View style={styles.miniEmpty}>
                <NovaPromptCard
                  title="Sin eventos hoy."
                  description="Crea uno desde Calendario o pídeselo a Nova."
                />
              </View>
            ) : (
              <View style={styles.timelineWrap}>
                {sortedEvents.map((evt) => (
                  <TimelineEventBlock
                    key={evt.id}
                    event={evt}
                    isPast={timeToH(evt.time) < nowH}
                    onDeletePress={() => handleDeleteEvent(evt.id, evt.title)}
                  />
                ))}
              </View>
            )}

            {/* ── Tareas pendientes ────────────────────────────────────────
                Se mantienen en sección separada hasta Paso 4 (integrar en
                timeline como bloques de tarea). */}
            <SectionLabel label="Tareas pendientes" count={pendingTasks.length} />
            {pendingTasks.length === 0 ? (
              <View style={styles.miniEmpty}>
                <NovaPromptCard
                  title={totalDoneToday > 0 ? '¡Listo por hoy!' : 'Todo en orden'}
                  description={
                    totalDoneToday > 0
                      ? `Completaste ${totalDoneToday} tarea${totalDoneToday === 1 ? '' : 's'} hoy.`
                      : 'Crea nuevas desde la pestaña Tareas.'
                  }
                />
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },

  // Header legacy-style
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerBtn: {
    paddingBottom: 6,
  },
  dateLine: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    lineHeight: 14,
    marginBottom: 6,
  },
  titleLine: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
    letterSpacing: -0.5,
  },

  bannerWrap: { paddingHorizontal: Spacing.lg },
  cardWrap: { paddingHorizontal: Spacing.lg },
  miniEmpty: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  timelineWrap: { paddingTop: Spacing.sm },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
