import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientNova } from '@/components/nova/AmbientNova';
import { useTodayContext } from '@/src/data/useTodayContext';

import { LoadingState } from '@/components/LoadingState';
import { SwipeNavigator } from '@/components/navigation/SwipeNavigator';
import { NovaInputBar, type NovaInputSeed } from '@/components/nova/NovaInputBar';
import { EmptyDayState } from '@/components/planner/EmptyDayState';
import { NextBlockCard } from '@/components/planner/NextBlockCard';
import { TimelineEventBlock } from '@/components/planner/TimelineEventBlock';
import { TimelineTaskBlock } from '@/components/planner/TimelineTaskBlock';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
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
  const todayCtx = useTodayContext();

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
  const [novaSeed, setNovaSeed] = useState<NovaInputSeed>({ text: '', n: 0 });
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

  const handleShare = useCallback(() => {
    void Share.share({
      message: 'Mira Focus, mi app para organizar el día con IA: https://usefocus.me',
    });
  }, []);

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
      {/* ── Ambient Nova ──────────────────────────────────────────────
          Pulso modulado por /api/today-context: low/medium/high según
          urgencia, calendario apretado, o insight actionable detectado. */}
      <AmbientNova scheme={scheme} level={todayCtx.data?.ambient ?? 'low'} />

      <SwipeNavigator currentTab="index">
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, !hasAnyItem && !loading && styles.scrollContentEmpty]}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={c.text}
            />
          }
        >
          {/* ── Top icon row (perfil, compartir, bandeja Nova, notificaciones) ── */}
          <View style={styles.iconRow}>
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              accessibilityLabel="Perfil"
              accessibilityRole="button"
            >
              <IconSymbol name="person.crop.circle.fill" size={26} color={c.primary} />
            </Pressable>
            <Pressable
              onPress={handleShare}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              accessibilityLabel="Compartir"
              accessibilityRole="button"
            >
              <IconSymbol name="square.and.arrow.up" size={22} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/nova')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              accessibilityLabel="Bandeja de Nova"
              accessibilityRole="button"
            >
              <IconSymbol name="tray.fill" size={22} color={c.text} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.iconBtn,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
              accessibilityLabel="Notificaciones"
              accessibilityRole="button"
            >
              <IconSymbol name="bell.fill" size={22} color={c.text} />
            </Pressable>
          </View>

          {/* ── Header AI-native ─────────────────── */}
          <View style={styles.header}>
            <Text style={[styles.titleLine, { color: c.text }]}>Mi día</Text>
            <Text style={[styles.subLine, { color: c.primary }]} numberOfLines={1}>
              <Text style={styles.subLineStrong}>{greeting}</Text>
              <Text style={{ color: c.textMuted }}>{`  ·  ${dateLabel}`}</Text>
            </Text>
          </View>

          {/* Error compacto — chip discreto en vez de banner gigante. No
              bloquea el empty state: el usuario sigue pudiendo pedirle a
              Nova que cree algo, y la próxima sincronización lo refleja. */}
          {error && !loading ? (
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.errorChip,
                {
                  backgroundColor: scheme === 'dark' ? 'rgba(239,68,68,0.15)' : '#fef2f2',
                  borderColor: scheme === 'dark' ? 'rgba(239,68,68,0.4)' : '#fecaca',
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sin conexión, toca para reintentar"
            >
              <IconSymbol name="arrow.clockwise" size={12} color="#dc2626" />
              <Text style={styles.errorChipText}>Sin conexión · Reintentar</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <LoadingState />
          ) : !hasAnyItem ? (
            <View style={styles.emptyFill}>
              <EmptyDayState
                onPickPrompt={seedNova}
                summaryOverride={todayCtx.data?.summary ?? null}
                weatherTip={todayCtx.data?.weather ?? null}
              />
            </View>
          ) : (
            <>
              {/* Timeline: eventos por hora + tareas hoy al final */}
              <View style={styles.timelineWrap}>
                {sortedEvents.map((evt, idx) => (
                  <TimelineEventBlock
                    key={evt.id}
                    event={evt}
                    isPast={timeToH(evt.time) < nowH}
                    done={doneEventIds.has(evt.id)}
                    onToggleDone={() => toggleEventDone(evt.id)}
                    onDeletePress={() => handleDeleteEvent(evt.id, evt.title)}
                    onSwipeDelete={() => void events.removeEvent(evt.id)}
                    enterIndex={idx}
                  />
                ))}
                {pendingTasks.map((t, idx) => (
                  <TimelineTaskBlock
                    key={t.id}
                    task={t}
                    onToggle={tasks.toggleTask}
                    onDeletePress={() => handleDeleteTask(t.id, t.label)}
                    onSwipeDelete={() => void tasks.removeTask(t.id)}
                    enterIndex={sortedEvents.length + idx}
                  />
                ))}
              </View>

              {/* Próximo Bloque / En Curso — orientación temporal del día */}
              <NextBlockCard events={events.events} />
            </>
          )}
        </ScrollView>

        {/* Input Nova persistente, anclado abajo. Compartido con Calendario y
            Tareas: misma barra, contexto distinto. */}
        <NovaInputBar
          context={{ type: 'day' }}
          events={events.events}
          tasks={tasks.tasks}
          onAddEvent={events.addEvent}
          onAddTask={tasks.addTask}
          onRemoveEvent={events.removeEvent}
          onRemoveTask={tasks.removeTask}
          onRefresh={handleRefresh}
          seed={novaSeed}
        />
      </KeyboardAvoidingView>
      </SwipeNavigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  // 48px asegura que el último bloque del timeline no quede oculto detrás
  // del CustomTabBar (que tiene su propia safe area). Sin este margen, el
  // botón "HECHO ✓" del último item podía quedar parcialmente cubierto.
  // Más paddingBottom: ahora el NovaInputBar vive sobre el ScrollView,
  // así que el último item del timeline no debe quedar oculto detrás de él.
  scrollContent: { paddingBottom: 16 },
  scrollContentEmpty: { flexGrow: 1 },
  emptyFill: { flex: 1, justifyContent: 'center', paddingBottom: 16 },


  // Fila de íconos top-right — perfil, compartir, bandeja Nova, notif.
  // alignSelf: flex-end agrupa todo a la derecha como en la versión web.
  iconRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    gap: Spacing.md + 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header tighter — antes paddingBottom Spacing['2xl']+xs (28px) creaba
  // un hueco grande entre saludo y primer evento. Spacing.xl da una
  // separación clara sin agujero.
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: 4,
  },

  // Chip de error compacto — reemplaza el ErrorBanner gigante. Toca para
  // reintentar, no bloquea el resto de la pantalla.
  errorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
  },
  errorChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    letterSpacing: 0.2,
  },
  titleLine: {
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subLine: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    marginTop: 2,
  },
  subLineStrong: {
    fontWeight: '600',
  },

  timelineWrap: { paddingTop: Spacing.sm },
});
