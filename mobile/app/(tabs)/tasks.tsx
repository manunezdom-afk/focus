import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { NovaOrb } from '@/components/nova/NovaOrb';
import { TaskRow } from '@/components/TaskRow';
import { Card } from '@/components/ui/Card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgressCard } from '@/components/ui/ProgressCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Task, TaskPriority } from '@/src/data/types';
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
  const inputRef = useRef<TextInput>(null);
  const [showInput, setShowInput] = useState(false);
  const [addCategory, setAddCategory] = useState<Category>('hoy');
  const [draft, setDraft] = useState('');
  const [draftPriority, setDraftPriority] = useState<TaskPriority>('Media');
  const [submitting, setSubmitting] = useState(false);

  // Stats: progreso de hoy
  const todayTasks = useMemo(
    () => tasks.tasks.filter((t) => t.category === 'hoy'),
    [tasks.tasks],
  );
  const todayDone = useMemo(() => todayTasks.filter((t) => t.done).length, [todayTasks]);
  const hasPendingToday = todayTasks.some((t) => !t.done);

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
    }
  }

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

  const showLoadingState = tasks.loading && tasks.tasks.length === 0;
  const totalTasks = tasks.tasks.length;
  const isFullyEmpty = !showLoadingState && totalTasks === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Hero halo — patrón compartido con Mi Día / Calendar / Nova. */}
      <View style={styles.heroHaloLayer} pointerEvents="none">
        <View
          style={[
            styles.heroHaloCircle,
            { backgroundColor: c.primaryContainer, opacity: scheme === 'dark' ? 0.45 : 0.55 },
          ]}
        />
        <View
          style={[
            styles.heroHaloCircleSoft,
            { backgroundColor: c.primaryContainer, opacity: scheme === 'dark' ? 0.18 : 0.22 },
          ]}
        />
      </View>

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
              refreshing={tasks.refreshing}
              onRefresh={tasks.refresh}
              tintColor={c.text}
            />
          }
        >
          {/* ── Header premium — título + subtítulo dinámico + CTA Nova ── */}
          <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={[styles.titleLine, { color: c.text }]}>Tareas</Text>
                <Text style={styles.subLine} numberOfLines={1}>
                  <Text style={[styles.subLineStrong, { color: c.primary }]}>
                    {summary.headerSubtitle.split('·')[0].trim().split(' ')[0]}
                  </Text>
                  <Text style={{ color: c.textMuted }}>
                    {`  ·  ${summary.headerSubtitle.replace(/^\S+\s/, '')}`}
                  </Text>
                </Text>
              </View>

              {hasPendingToday ? (
                <Pressable
                  onPress={goToNova}
                  style={({ pressed }) => [
                    styles.novaCta,
                    {
                      backgroundColor: pressed ? c.primaryContainer : c.surfaceTint,
                      borderColor: c.primary,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Pedir a Nova que organice"
                >
                  <IconSymbol name="sparkles" size={13} color={c.primary} />
                  <Text style={[styles.novaCtaText, { color: c.primary }]}>
                    Nova, organízame
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>

          {/* Smart summary card — siempre visible, copy desde datos reales */}
          {!showLoadingState ? (
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
                <NovaOrb size={36} ambient={false} />
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
            <FullyEmptyState onCreate={() => openAddFor('hoy')} onAskNova={goToNova} />
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Empty state hero cuando no hay NINGUNA tarea (en lugar de mostrar
// las 3 secciones vacías). NovaOrb central + título + 2 CTAs.
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
      entering={FadeInDown.delay(140).duration(420)}
      style={styles.emptyHero}
    >
      <NovaOrb size={84} ambient />
      <Text style={[styles.emptyTitle, { color: c.text }]}>
        No tienes tareas pendientes.
      </Text>
      <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
        Crea una manualmente o pídele a Nova que organice tus pendientes.
      </Text>
      <View style={styles.emptyActions}>
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Crear nueva tarea"
        >
          <IconSymbol name="plus" size={17} color={c.onPrimary} />
          <Text style={[styles.primaryCtaText, { color: c.onPrimary }]}>Nueva tarea</Text>
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
          accessibilityLabel="Crear con Nova"
        >
          <IconSymbol name="sparkles" size={17} color={c.primary} />
          <Text style={[styles.secondaryCtaText, { color: c.primary }]}>
            Crear con Nova
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },

  // Hero halo — mismos números que Mi Día / Calendar / Nova
  heroHaloLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    overflow: 'hidden',
  },
  heroHaloCircle: {
    position: 'absolute',
    top: -120,
    left: -60,
    right: -60,
    height: 320,
    borderBottomLeftRadius: 240,
    borderBottomRightRadius: 240,
  },
  heroHaloCircleSoft: {
    position: 'absolute',
    top: 60,
    left: -120,
    right: -120,
    height: 280,
    borderRadius: 240,
    transform: [{ scaleY: 0.55 }],
  },

  // Header premium
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
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
    marginTop: 4,
  },
  subLineStrong: {
    fontWeight: '700',
  },
  novaCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  novaCtaText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Smart summary card
  summaryWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
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
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  summaryDesc: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },

  progressWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  bannerWrap: { paddingHorizontal: Spacing.lg },

  // Empty state hero (cuando 0 tareas totales)
  emptyHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  emptyDesc: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    alignSelf: 'stretch',
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
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '700',
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
});
