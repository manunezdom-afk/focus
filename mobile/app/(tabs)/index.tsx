import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/ErrorBanner';
import { EventRow } from '@/components/EventRow';
import { LoadingState } from '@/components/LoadingState';
import { TaskRow } from '@/components/TaskRow';
import { Card } from '@/components/ui/Card';
import { NovaPromptCard } from '@/components/ui/NovaPromptCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { QuickActionButton } from '@/components/ui/QuickActionButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayLabelLong } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

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

  const dateLabel = useMemo(() => todayLabelLong(), []);
  const eyebrow = useMemo(() => greeting(), []);

  // Tareas pendientes hoy (similar al modelo legacy: category === 'hoy' es lo
  // que aparece en Mi Día; si no hay esa categoría, mostramos pending top 8).
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

  function notImplemented(feature: string) {
    Alert.alert(
      feature,
      'Esta función estará disponible en la próxima versión. Por ahora puedes pedírselo a Nova.',
      [{ text: 'Entendido', style: 'default' }],
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
        {/* Header — eyebrow primary + título grande extrabold + fecha completa */}
        <ScreenHeader
          eyebrow={eyebrow}
          title="Mi día"
          subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
          rightAction={
            <PrimaryButton
              label="Añadir"
              size="sm"
              onPress={() => router.push('/calendar')}
            />
          }
        />

        {error ? (
          <View style={styles.bannerWrap}>
            <ErrorBanner message="No pudimos cargar tus datos." onRetry={handleRefresh} />
          </View>
        ) : null}

        {loading ? (
          <LoadingState />
        ) : !hasAnyItem ? (
          // Empty state legacy: Nova prompt card + grid 2-col de quick actions.
          <View style={styles.emptyWrap}>
            <NovaPromptCard
              title="Tu agenda de hoy está vacía."
              description="Dile a Nova qué tienes hoy, o añade algo tú mismo."
            />
            <View style={styles.actionsGrid}>
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
              <View style={styles.actionsRow}>
                <QuickActionButton
                  label="Dictar"
                  iconName="sparkles"
                  onPress={() => notImplemented('Dictado')}
                  disabled
                />
                <QuickActionButton
                  label="Foto de agenda"
                  iconName="plus"
                  onPress={() => notImplemented('Foto de agenda')}
                  disabled
                />
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Eventos de hoy */}
            <SectionLabel label="Eventos de hoy" count={events.events.length} />
            {events.events.length === 0 ? (
              <View style={styles.miniEmpty}>
                <NovaPromptCard
                  title="Sin eventos hoy."
                  description="Crea uno desde Calendario o pídeselo a Nova."
                />
              </View>
            ) : (
              <View style={styles.cardWrap}>
                <Card variant="default">
                  {events.events.map((evt) => (
                    <EventRow key={evt.id} event={evt} />
                  ))}
                </Card>
              </View>
            )}

            {/* Tareas pendientes */}
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

  bannerWrap: { paddingHorizontal: Spacing.lg },
  cardWrap: { paddingHorizontal: Spacing.lg },
  miniEmpty: { paddingHorizontal: Spacing.lg },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  actionsGrid: {
    gap: Spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
