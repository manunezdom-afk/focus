import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { SwipeNavigator } from '@/components/navigation/SwipeNavigator';
import { NovaInputBar } from '@/components/nova/NovaInputBar';
import { TaskRow } from '@/components/TaskRow';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { WeeklyStatsCard } from '@/components/tasks/WeeklyStatsCard';
import { Card } from '@/components/ui/Card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgressCard } from '@/components/ui/ProgressCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { setNovaSeed } from '@/src/data/novaSeedStore';
import type { Task, TaskPriority } from '@/src/data/types';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

const CATEGORIES = ['hoy', 'semana', 'algún día'] as const;
type Category = (typeof CATEGORIES)[number];

const CAT_LABELS: Record<Category, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  'algún día': 'Algún día',
};

const CAT_ICONS: Record<Category, React.ComponentProps<typeof IconSymbol>['name']> = {
  hoy: 'sun.max.fill',
  semana: 'calendar',
  'algún día': 'checklist',
};

const PRIORITIES: TaskPriority[] = ['Alta', 'Media', 'Baja'];

// Resumen inteligente client-side desde datos reales. NO llama IA.
// `next` es la próxima tarea pendiente prioritaria de hoy.
function buildSummary(tasks: Task[]): {
  headerSubtitle: string;
  cardTitle: string;
  cardDesc: string;
  highlightLabel: string | null;
} {
  const pending = tasks.filter((t) => !t.done);
  const today = pending.filter((t) => t.category === 'hoy' || !t.category);

  if (pending.length === 0) {
    return {
      headerSubtitle: 'Todo despejado · sin pendientes',
      cardTitle: 'Todo despejado por ahora.',
      cardDesc: 'Crea una tarea o pídele a Nova que organice tus pendientes.',
      highlightLabel: null,
    };
  }

  if (today.length === 0) {
    return {
      headerSubtitle: `${pending.length} ${pending.length === 1 ? 'tarea guardada' : 'tareas guardadas'}`,
      cardTitle: `Tienes ${pending.length} ${pending.length === 1 ? 'tarea' : 'tareas'} en próximos buckets.`,
      cardDesc: 'Sin pendientes para hoy. ¿Mueves alguna a Hoy?',
      highlightLabel: null,
    };
  }

  // Próxima de hoy: prioridad Alta primero, luego Media, luego Baja.
  const PRIO_RANK: Record<string, number> = { Alta: 0, Media: 1, Baja: 2 };
  const sorted = [...today].sort(
    (a, b) => (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1),
  );
  const next = sorted[0];

  return {
    headerSubtitle: `${today.length} ${today.length === 1 ? 'pendiente para hoy' : 'pendientes para hoy'}`,
    cardTitle: `${today.length} ${today.length === 1 ? 'tarea pendiente' : 'tareas pendientes'} para hoy.`,
    cardDesc: next ? `La más prioritaria: ${next.label}` : 'Toca una para empezar.',
    highlightLabel: next?.label ?? null,
  };
}

export default function TasksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const tasks = useTasks();
  const events = useEvents('all');
  const inputRef = useRef<TextInput>(null);
  const [showInput, setShowInput] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>('hoy');
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>('Media');
  const [submitting, setSubmitting] = useState(false);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Tracking de creaciones recientes para el flash chip "Añadidas N".
  // Es un array de timestamps ms; filtramos a la ventana de 4s en cada
  // render. Cuando hay 2+ creaciones recientes mostramos el chip.
  const [recentAdds, setRecentAdds] = useState<number[]>([]);

  // Stats: progreso de hoy
  const todayTasks = useMemo(
    () => tasks.tasks.filter((t) => t.category === 'hoy'),
    [tasks.tasks],
  );
  const todayDone = useMemo(() => todayTasks.filter((t) => t.done).length, [todayTasks]);

  // Resumen client-side desde datos reales
  const summary = useMemo(() => buildSummary(tasks.tasks), [tasks.tasks]);

  // Particiona por categoría
  const byCategory = useMemo(() => {
    const out: Record<Category, Task[]> = { hoy: [], semana: [], 'algún día': [] };
    for (const t of tasks.tasks) {
      const cat = (t.category as Category) || 'hoy';
      if (CATEGORIES.includes(cat)) out[cat].push(t);
      else out['algún día'].push(t);
    }
    return out;
  }, [tasks.tasks]);

  function openAddFor(cat: Category) {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setAddCategory(cat);
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function closeAddForm() {
    setShowInput(false);
    setDraft('');
  }

  async function handleAdd() {
    const label = draft.trim();
    if (!label || submitting) return;
    setSubmitting(true);
    const created = await tasks.addTask({
      label,
      priority: draftPriority,
      category: addCategory,
    });
    setSubmitting(false);
    if (created) {
      setDraft('');
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Registrar creación reciente para el flash chip.
      const now = Date.now();
      setRecentAdds((prev) => [...prev.filter((t) => now - t < 4000), now]);
    }
  }

  // Auto-limpiar el chip cuando la ventana de 4s pase. setTimeout corre
  // sobre el último timestamp para no acumular timers.
  useEffect(() => {
    if (recentAdds.length === 0) return;
    const lastAt = recentAdds[recentAdds.length - 1];
    const ttl = 4000 - (Date.now() - lastAt);
    if (ttl <= 0) {
      setRecentAdds([]);
      return;
    }
    const id = setTimeout(() => setRecentAdds([]), ttl);
    return () => clearTimeout(id);
  }, [recentAdds]);

  const flashCount = recentAdds.length;
  const showFlashChip = flashCount >= 2;

  const cycleCategory = useCallback(
    (id: string, current: string) => {
      const idx = CATEGORIES.indexOf(current as Category);
      const next = CATEGORIES[(idx + 1) % CATEGORIES.length];
      void tasks.patchTask(id, { category: next });
    },
    [tasks],
  );

  function goToNova() {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    router.push('/(tabs)/nova');
  }

  // CTA "Crear con Nova" del empty state → abre Nova con prompt para que
  // pida ayuda planificando los pendientes del día.
  function goToNovaForTasksSeed() {
    setNovaSeed('Ayúdame a planificar mis tareas para hoy.');
    goToNova();
  }

  const showLoadingState = tasks.loading && tasks.tasks.length === 0;
  const totalTasks = tasks.tasks.length;
  const isFullyEmpty = !showLoadingState && totalTasks === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <SwipeNavigator currentTab="tasks">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isFullyEmpty && styles.scrollContentEmpty,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={tasks.refreshing}
              onRefresh={tasks.refresh}
              tintColor={c.text}
            />
          }
        >
          {/* ── Header — eyebrow + título compacto, mismo lenguaje que Calendario ── */}
          <Animated.View entering={FadeInDown.duration(320)} style={styles.header}>
            <Text style={[styles.eyebrow, { color: c.primary }]} numberOfLines={1}>
              {summary.headerSubtitle}
            </Text>
            <Text style={[styles.titleLine, { color: c.text }]}>Tareas</Text>
          </Animated.View>

          {/* Smart summary card — copy desde datos reales, sin orb */}
          {!showLoadingState && totalTasks > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(60).duration(360)}
              style={styles.summaryWrap}
            >
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: c.surfaceTint, borderColor: c.border },
                ]}
              >
                <View style={[styles.summaryIcon, { backgroundColor: c.primaryContainer }]}>
                  <IconSymbol name="sparkles" size={14} color={c.primary} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={[styles.summaryTitle, { color: c.text }]} numberOfLines={2}>
                    {summary.cardTitle}
                  </Text>
                  <Text style={[styles.summaryDesc, { color: c.textMuted }]} numberOfLines={2}>
                    {summary.cardDesc}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {/* Card de progreso de hoy (cuando hay tareas hoy) */}
          {todayTasks.length > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(100).duration(360)}
              style={styles.progressWrap}
            >
              <ProgressCard done={todayDone} total={todayTasks.length} />
            </Animated.View>
          ) : null}

          {/* Resumen semanal — solo si hay alguna tarea para tener algo
              que mostrar (no inventamos métricas con un dataset vacío). */}
          {!showLoadingState && totalTasks > 0 ? (
            <Animated.View
              entering={FadeInDown.delay(140).duration(360)}
              style={styles.weeklyWrap}
            >
              <WeeklyStatsCard tasks={tasks.tasks} />
            </Animated.View>
          ) : null}

          {tasks.error ? (
            <View style={styles.bannerWrap}>
              <ErrorBanner
                message="No pudimos sincronizar tus tareas."
                onRetry={tasks.refresh}
              />
            </View>
          ) : null}

          {showLoadingState ? <LoadingState /> : null}

          {isFullyEmpty ? (
            <View style={styles.emptyFill}>
              <FullyEmptyState onCreate={() => openAddFor('hoy')} onAskNova={goToNovaForTasksSeed} />
            </View>
          ) : null}

          {!showLoadingState && !isFullyEmpty ? (
            <>
              {CATEGORIES.map((cat, idx) => {
                const items = byCategory[cat];
                const pending = items.filter((t) => !t.done).length;
                const isAddOpenHere = showInput && addCategory === cat;
                return (
                  <Animated.View
                    key={cat}
                    entering={FadeInDown.delay(140 + idx * 70).duration(360)}
                    style={styles.categoryWrap}
                  >
                    <View style={styles.catHeader}>
                      <View style={styles.catLeft}>
                        <IconSymbol name={CAT_ICONS[cat]} size={16} color={c.textMuted} />
                        <Text style={[styles.catLabel, { color: c.text }]}>
                          {CAT_LABELS[cat]}
                        </Text>
                        {pending > 0 ? (
                          <Text style={[styles.catCount, { color: c.textSubtle }]}>
                            ({pending})
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => openAddFor(cat)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.addBtn,
                          { backgroundColor: pressed ? c.surfaceTint : 'transparent' },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Añadir tarea a ${CAT_LABELS[cat]}`}
                      >
                        <IconSymbol name="plus" size={16} color={c.primary} />
                      </Pressable>
                    </View>

                    {items.length === 0 && !isAddOpenHere ? (
                      <Pressable
                        onPress={() => openAddFor(cat)}
                        style={({ pressed }) => [
                          styles.dashedAdd,
                          {
                            borderColor: c.border,
                            backgroundColor: pressed ? c.surfaceTint : 'transparent',
                          },
                        ]}
                        accessibilityRole="button"
                      >
                        <View style={[styles.miniDot, { backgroundColor: c.surfaceTint }]}>
                          <IconSymbol name="plus" size={14} color={c.primary} />
                        </View>
                        <Text style={[styles.dashedText, { color: c.textMuted }]}>
                          Añadir tarea a{' '}
                          <Text style={{ color: c.text, fontWeight: '600' }}>
                            {CAT_LABELS[cat]}
                          </Text>
                        </Text>
                      </Pressable>
                    ) : null}

                    {items.length > 0 ? (
                      <Card variant="default">
                        {items.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            onToggle={tasks.toggleTask}
                            onDelete={tasks.removeTask}
                            onCycleCategory={cycleCategory}
                            onOpenDetail={setDetailTask}
                          />
                        ))}
                      </Card>
                    ) : null}

                    {isAddOpenHere ? (
                      <View
                        style={[
                          styles.composer,
                          { backgroundColor: c.surface, borderColor: c.primary },
                        ]}
                      >
                        <TextInput
                          ref={inputRef}
                          value={draft}
                          onChangeText={setDraft}
                          onSubmitEditing={handleAdd}
                          placeholder="¿Qué necesitas hacer?"
                          placeholderTextColor={c.textSubtle}
                          style={[styles.input, { color: c.text }]}
                          autoFocus
                          autoCorrect
                          autoCapitalize="sentences"
                          returnKeyType="done"
                          editable={!submitting}
                          maxLength={200}
                        />
                        <View style={styles.composerRow}>
                          <View style={styles.priorityRow}>
                            {PRIORITIES.map((p) => (
                              <Pressable
                                key={p}
                                onPress={() => setDraftPriority(p)}
                                style={({ pressed }) => [
                                  styles.priorityBtn,
                                  {
                                    backgroundColor:
                                      draftPriority === p ? c.surfaceTint : 'transparent',
                                    opacity: pressed ? 0.7 : 1,
                                  },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Prioridad ${p}`}
                              >
                                <Text
                                  style={[
                                    styles.priorityText,
                                    {
                                      color:
                                        draftPriority === p ? c.primary : c.textMuted,
                                    },
                                  ]}
                                >
                                  {p}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                          <Pressable
                            onPress={closeAddForm}
                            hitSlop={8}
                            style={styles.composerAction}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[styles.composerActionText, { color: c.textMuted }]}
                            >
                              Cerrar
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={handleAdd}
                            disabled={!draft.trim() || submitting}
                            hitSlop={8}
                            style={styles.composerAction}
                            accessibilityRole="button"
                          >
                            <Text
                              style={[
                                styles.composerActionText,
                                styles.composerActionPrimary,
                                { color: draft.trim() ? c.primary : c.textSubtle },
                              ]}
                            >
                              Añadir
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </Animated.View>
                );
              })}
            </>
          ) : null}
        </ScrollView>

        <NovaInputBar
          context={{ type: 'tasks' }}
          events={events.events}
          tasks={tasks.tasks}
          onAddEvent={events.addEvent}
          onAddTask={tasks.addTask}
          onRefresh={() => {
            void tasks.refresh();
            void events.refresh();
          }}
        />
      </KeyboardAvoidingView>

      {/* Flash chip: aparece tras crear varias tareas seguidas (≤4s). */}
      {showFlashChip ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[styles.flashChip, { backgroundColor: c.primary, shadowColor: c.primary }]}
        >
          <IconSymbol name="checkmark" size={12} color={c.onPrimary} weight="semibold" />
          <Text style={[styles.flashChipText, { color: c.onPrimary }]}>
            {`Añadidas ${flashCount}`}
          </Text>
        </Animated.View>
      ) : null}
      </SwipeNavigator>

      <TaskDetailSheet
        task={detailTask}
        visible={!!detailTask}
        onDismiss={() => setDetailTask(null)}
        onSave={tasks.patchTask}
        onDelete={tasks.removeTask}
      />
    </SafeAreaView>
  );
}

// Empty state hero cuando no hay NINGUNA tarea. Copy diferenciado del
// Calendario: aquí hablamos de pila de pendientes, no de día libre.
// Botón secundario removido — el NovaInputBar abajo ya cubre ese flow.
function FullyEmptyState({
  onCreate,
  onAskNova,
}: {
  onCreate: () => void;
  onAskNova: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Animated.View
      entering={FadeInDown.delay(120).duration(380)}
      style={styles.emptyWrap}
    >
      <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: c.primaryContainer }]}>
          <IconSymbol name="checklist" size={24} color={c.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Tu lista está limpia.</Text>
        <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
          Crea tu próxima tarea o describe lo que tienes en mente abajo y Nova lo añade por ti.
        </Text>
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Crear nueva tarea"
        >
          <IconSymbol name="plus" size={16} color={c.onPrimary} />
          <Text style={[styles.primaryBtnText, { color: c.onPrimary }]}>Nueva tarea</Text>
        </Pressable>
        <Pressable
          onPress={onAskNova}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: c.border, backgroundColor: pressed ? c.surfaceMuted : 'transparent' },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Pedirle a Nova que organice"
        >
          <IconSymbol name="sparkles" size={16} color={c.primary} />
          <Text style={[styles.secondaryBtnText, { color: c.primary }]}>Organizar con Nova</Text>
        </Pressable>
      </View>

      {/* Ejemplos fantasma — desaparecen cuando aparece la primera tarea
          real (porque isFullyEmpty pasa a false y este bloque entero no se
          renderiza). Solo demuestra cómo se ven las tareas. */}
      <Text style={[styles.exampleHeader, { color: c.textSubtle }]}>
        ASÍ SE VERÁN TUS TAREAS
      </Text>
      <View style={styles.exampleList}>
        <ExampleTaskCard label="Llamar al dentista" priority="Media" colorScheme={scheme} />
        <ExampleTaskCard label="Terminar propuesta de cliente" priority="Alta" colorScheme={scheme} />
        <ExampleTaskCard label="Comprar cumpleaños mamá" priority="Baja" colorScheme={scheme} />
      </View>
    </Animated.View>
  );
}

// Tarjeta fantasma — solo visual. No persiste, no es interactiva. Se muestra
// debajo del card "Tu lista está limpia" para enseñar cómo se verán las
// tareas reales. Cuando el usuario crea su primera tarea, isFullyEmpty pasa
// a false y este bloque desaparece completo.
function ExampleTaskCard({
  label,
  priority,
  colorScheme,
}: {
  label: string;
  priority: 'Alta' | 'Media' | 'Baja';
  colorScheme: 'light' | 'dark';
}) {
  const c = Colors[colorScheme];
  const accent = '#7c3aed'; // morado tarea, igual que TimelineTaskBlock
  const priColor =
    priority === 'Alta' ? '#dc2626' : priority === 'Baja' ? c.textSubtle : accent;

  return (
    <View
      style={[
        styles.exampleCard,
        { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accent },
      ]}
    >
      <View style={[styles.exampleCheck, { borderColor: c.borderStrong }]} />
      <View style={styles.exampleBody}>
        <Text style={[styles.exampleLabel, { color: c.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={[styles.examplePriPill, { backgroundColor: c.surfaceMuted }]}>
        <Text style={[styles.examplePriText, { color: priColor }]}>{priority}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },
  scrollContentEmpty: { flexGrow: 1, paddingBottom: 16 },
  emptyFill: { flex: 1, justifyContent: 'center' },

  // Header — eyebrow + title estilo Calendario (compacto, fino)
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: 3,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  titleLine: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.7,
  },

  // Smart summary card
  summaryWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  summaryDesc: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },

  progressWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  weeklyWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  bannerWrap: { paddingHorizontal: Spacing.lg },

  // Empty state — mismo lenguaje visual que Calendario.
  // Sin marginTop: el wrapper emptyFill centra verticalmente el card.
  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  exampleHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  exampleList: {
    gap: 8,
    opacity: 0.5,
  },
  exampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
  },
  exampleCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  exampleBody: {
    flex: 1,
  },
  exampleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  examplePriPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  examplePriText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  emptyCard: {
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptyDesc: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: Radius.full,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  categoryWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  catLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catLabel: { ...Typography.bodyStrong, fontSize: 14 },
  catCount: { fontSize: 11, fontWeight: '700' },
  addBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },

  dashedAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  miniDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedText: { ...Typography.caption, fontSize: 12 },

  composer: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  input: {
    ...Typography.body,
    minHeight: 24,
    paddingVertical: 6,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 2,
  },
  priorityBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  composerAction: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  composerActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  composerActionPrimary: { fontWeight: '700' },

  // Flash chip — pill superior centrado que avisa "Añadidas N".
  flashChip: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  flashChipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
