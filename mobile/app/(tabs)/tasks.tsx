import * as Haptics from 'expo-haptics';
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
import { AmbientNova } from '@/components/nova/AmbientNova';
import { NovaInputBar } from '@/components/nova/NovaInputBar';
import { TaskRow } from '@/components/TaskRow';
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet';
import { WeeklyStatsCard } from '@/components/tasks/WeeklyStatsCard';
import { Card } from '@/components/ui/Card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgressCard } from '@/components/ui/ProgressCard';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Task, TaskPriority } from '@/src/data/types';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Buckets visibles en Tareas. "Próximas" es virtual: agrupa tasks con
// `dueDate` set, sin importar su `category`. Las otras 3 son la categoría
// real persistida en DB. El bulk defer solo mueve entre las 3 reales
// (cambiar category); para mover a Próximas hay que setear dueDate desde
// el detalle (TaskDetailSheet).
const CATEGORIES = ['hoy', 'semana', 'algún día'] as const;
type Category = (typeof CATEGORIES)[number];
type Bucket = 'proximas' | Category;

const CAT_LABELS: Record<Category, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  'algún día': 'Algún día',
};

const BUCKET_LABELS: Record<Bucket, string> = {
  proximas:    'Próximas',
  hoy:         'Hoy',
  semana:      'Esta semana',
  'algún día': 'Algún día',
};

const BUCKET_ICONS: Record<Bucket, React.ComponentProps<typeof IconSymbol>['name']> = {
  proximas:    'calendar',
  hoy:         'sun.max.fill',
  semana:      'calendar',
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

  // Particiona en 4 buckets: Próximas (dueDate set) primero, luego las 3
  // categorías clásicas. Una tarea con dueDate aparece SOLO en Próximas;
  // si quieres que también aparezca en Hoy, no setees dueDate.
  // Próximas se ordena por dueDate ASC, luego dueTime ASC NULLS LAST.
  const byBucket = useMemo(() => {
    const out: Record<Bucket, Task[]> = {
      proximas:    [],
      hoy:         [],
      semana:      [],
      'algún día': [],
    };
    for (const t of tasks.tasks) {
      if (t.dueDate) {
        out.proximas.push(t);
        continue;
      }
      const cat = (t.category as Category) || 'hoy';
      if (CATEGORIES.includes(cat)) out[cat].push(t);
      else out['algún día'].push(t);
    }
    out.proximas.sort((a, b) => {
      const d = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
      if (d !== 0) return d;
      // Sin hora va al final del día (NULLS LAST).
      if (!a.dueTime && b.dueTime) return 1;
      if (a.dueTime && !b.dueTime) return -1;
      return (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
    });
    return out;
  }, [tasks.tasks]);

  // Selección múltiple para bulk defer. Visualmente: cada row reemplaza
  // su badge de prioridad por un checkbox cuando selectionMode=true.
  // Tap en row toggle selección (no toggle done). Long-press deshabilitado
  // mientras estamos en selectionMode.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Mueve todas las tareas seleccionadas a otra category. NO toca dueDate
  // — para sacarlas de Próximas habría que limpiar el campo desde el
  // detalle. Aplicamos en paralelo con Promise.all; los errores indivi-
  // duales caen en el catch interno de patchTask y muestran banner.
  const bulkDefer = useCallback(
    async (target: Category) => {
      if (selectedIds.size === 0) return;
      const ids = Array.from(selectedIds);
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await Promise.all(ids.map((id) => tasks.patchTask(id, { category: target })));
      exitSelection();
    },
    [selectedIds, tasks, exitSelection],
  );

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


  const showLoadingState = tasks.loading && tasks.tasks.length === 0;
  const totalTasks = tasks.tasks.length;
  // No mostrar el empty hero (con example ghost cards) cuando hay error
  // de carga y 0 tareas — el usuario podría pensar que su lista está
  // vacía cuando en realidad falló el fetch. En ese caso dejamos solo
  // el ErrorBanner con su botón Reintentar.
  const isFullyEmpty = !showLoadingState && !tasks.error && totalTasks === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <AmbientNova scheme={scheme} level="low" />
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
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={tasks.refreshing}
              onRefresh={tasks.refresh}
              tintColor={c.text}
            />
          }
        >
          {/* ── Header — eyebrow + título compacto, mismo lenguaje que Calendario ── */}
          <Animated.View style={styles.header}>
            <Text style={[styles.eyebrow, { color: c.primary }]} numberOfLines={1}>
              {summary.headerSubtitle}
            </Text>
            <Text style={[styles.titleLine, { color: c.text }]}>Tareas</Text>
          </Animated.View>

          {/* Smart summary card — copy desde datos reales, sin orb */}
          {!showLoadingState && totalTasks > 0 ? (
            <Animated.View
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
              style={styles.progressWrap}
            >
              <ProgressCard done={todayDone} total={todayTasks.length} />
            </Animated.View>
          ) : null}

          {/* Resumen semanal — solo si hay alguna tarea para tener algo
              que mostrar (no inventamos métricas con un dataset vacío). */}
          {!showLoadingState && totalTasks > 0 ? (
            <Animated.View
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
              <FullyEmptyState
                onCreate={() => openAddFor('hoy')}
                onQuickAdd={async (label) => {
                  if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await tasks.addTask({ label, priority: 'Media', category: 'hoy' });
                }}
              />
            </View>
          ) : null}

          {/* CTA "Seleccionar varias" — visible solo si hay >1 tarea. Activa
              modo bulk defer. Cuando estamos seleccionando, este CTA cambia a
              "Cancelar selección" para salir sin aplicar cambios. */}
          {!showLoadingState && totalTasks > 1 ? (
            <View style={styles.bulkCtaWrap}>
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'ios') void Haptics.selectionAsync();
                  if (selectionMode) exitSelection();
                  else setSelectionMode(true);
                }}
                style={({ pressed }) => [
                  styles.bulkCta,
                  {
                    backgroundColor: selectionMode ? c.primaryContainer : c.surface,
                    borderColor: selectionMode ? c.primary : c.border,
                    opacity: pressed ? 0.7 : 1,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={selectionMode ? 'Cancelar selección' : 'Seleccionar varias tareas'}
              >
                <IconSymbol
                  name={selectionMode ? 'xmark' : 'checklist'}
                  size={13}
                  color={selectionMode ? c.primary : c.textMuted}
                />
                <Text
                  style={[
                    styles.bulkCtaText,
                    { color: selectionMode ? c.primary : c.textMuted },
                  ]}
                >
                  {selectionMode
                    ? `Cancelar (${selectedIds.size} seleccionada${selectedIds.size === 1 ? '' : 's'})`
                    : 'Seleccionar varias'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!showLoadingState && !isFullyEmpty ? (
            <>
              {(['proximas', 'hoy', 'semana', 'algún día'] as Bucket[]).map((bucket, idx) => {
                const items = byBucket[bucket];
                // Próximas se renderiza solo si tiene items (no tiene CTA de
                // "añadir vacío" — para añadir a Próximas hay que setear
                // dueDate desde el detalle).
                if (bucket === 'proximas' && items.length === 0) return null;
                const pending = items.filter((t) => !t.done).length;
                const isCategoryBucket = bucket !== 'proximas';
                const cat = isCategoryBucket ? (bucket as Category) : null;
                const isAddOpenHere = showInput && cat !== null && addCategory === cat;
                return (
                  <Animated.View
                    key={bucket}
                    style={styles.categoryWrap}
                  >
                    <View style={styles.catHeader}>
                      <View style={styles.catLeft}>
                        <IconSymbol name={BUCKET_ICONS[bucket]} size={16} color={c.textMuted} />
                        <Text style={[styles.catLabel, { color: c.text }]}>
                          {BUCKET_LABELS[bucket]}
                        </Text>
                        {pending > 0 ? (
                          <Text style={[styles.catCount, { color: c.textSubtle }]}>
                            ({pending})
                          </Text>
                        ) : null}
                      </View>
                      {cat ? (
                        <Pressable
                          onPress={() => openAddFor(cat)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.addBtn,
                            {
                              backgroundColor: pressed ? c.surfaceTint : 'transparent',
                              transform: [{ scale: pressed ? 0.92 : 1 }],
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Añadir tarea a ${CAT_LABELS[cat]}`}
                        >
                          <IconSymbol name="plus" size={16} color={c.primary} />
                        </Pressable>
                      ) : null}
                    </View>

                    {cat && items.length === 0 && !isAddOpenHere ? (
                      <Pressable
                        onPress={() => openAddFor(cat)}
                        style={({ pressed }) => [
                          styles.dashedAdd,
                          {
                            borderColor: c.border,
                            backgroundColor: pressed ? c.surfaceTint : 'transparent',
                            transform: [{ scale: pressed ? 0.992 : 1 }],
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
                            // El cycle button no tiene sentido cuando estamos
                            // seleccionando — dejamos solo TaskRow básico.
                            onCycleCategory={selectionMode ? undefined : cycleCategory}
                            onOpenDetail={selectionMode ? undefined : setDetailTask}
                            selectionMode={selectionMode}
                            selected={selectedIds.has(t.id)}
                            onToggleSelected={toggleSelected}
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
                                    transform: [{ scale: pressed ? 0.96 : 1 }],
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
          onPatchEvent={events.patchEvent}
          onRemoveEvent={events.removeEvent}
          onRemoveTask={tasks.removeTask}
          onRefresh={() => {
            void tasks.refresh();
            void events.refresh();
          }}
        />
      </KeyboardAvoidingView>

      {/* Bulk action bar — aparece solo cuando hay >0 selección. Botones
          mueven todas las seleccionadas a la category clickeada. NO toca
          dueDate (las tareas en Próximas siguen ahí; mover a Hoy/Semana/
          Algún día solo cambia category). */}
      {selectionMode && selectedIds.size > 0 ? (
        <Animated.View
          style={[
            styles.bulkBar,
            { backgroundColor: c.surface, borderColor: c.border, shadowColor: c.text },
          ]}
        >
          <Text style={[styles.bulkBarTitle, { color: c.text }]}>
            {selectedIds.size === 1
              ? '1 tarea · Mover a:'
              : `${selectedIds.size} tareas · Mover a:`}
          </Text>
          <View style={styles.bulkBarRow}>
            {(['hoy', 'semana', 'algún día'] as Category[]).map((target) => (
              <Pressable
                key={target}
                onPress={() => void bulkDefer(target)}
                style={({ pressed }) => [
                  styles.bulkBarBtn,
                  {
                    backgroundColor: pressed ? c.primaryPressed : c.primary,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Mover a ${CAT_LABELS[target]}`}
              >
                <Text style={[styles.bulkBarBtnText, { color: c.onPrimary }]}>
                  {CAT_LABELS[target]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* Flash chip: aparece tras crear varias tareas seguidas (≤4s). */}
      {showFlashChip ? (
        <Animated.View
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

// Plantillas rápidas — Nova ofrece tareas comunes con 1 tap (no abre chat).
// Eliminamos "Organizar con Nova" porque mandaba al usuario a la misma
// pantalla de Nova y eso era absurdo. Esto SÍ resuelve algo.
const QUICK_TEMPLATES: { label: string }[] = [
  { label: 'Estudiar 1 hora' },
  { label: 'Hacer ejercicio' },
  { label: 'Llamar a alguien' },
  { label: 'Revisar correos' },
  { label: 'Pagar facturas' },
];

// Empty state hero cuando no hay NINGUNA tarea. Copy diferenciado del
// Calendario: aquí hablamos de pila de pendientes, no de día libre.
function FullyEmptyState({
  onCreate,
  onQuickAdd,
}: {
  onCreate: () => void;
  onQuickAdd: (label: string) => Promise<void> | void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Animated.View style={styles.emptyWrap}>
      <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: c.primaryContainer }]}>
          <IconSymbol name="checklist" size={24} color={c.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Tu lista está limpia.</Text>
        <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
          Toca una plantilla para añadirla al instante o crea tu propia tarea.
        </Text>
        <View style={styles.quickChipsRow}>
          {QUICK_TEMPLATES.map((tpl) => (
            <Pressable
              key={tpl.label}
              onPress={() => void onQuickAdd(tpl.label)}
              style={({ pressed }) => [
                styles.quickChip,
                {
                  borderColor: c.border,
                  backgroundColor: pressed ? c.primaryContainer : 'transparent',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Agregar plantilla: ${tpl.label}`}
            >
              <IconSymbol name="plus" size={11} color={c.primary} />
              <Text style={[styles.quickChipText, { color: c.text }]} numberOfLines={1}>
                {tpl.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: pressed ? c.primaryPressed : c.primary,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Crear nueva tarea"
        >
          <IconSymbol name="plus" size={16} color={c.onPrimary} />
          <Text style={[styles.primaryBtnText, { color: c.onPrimary }]}>Nueva tarea propia</Text>
        </Pressable>
      </View>

      {/* Ejemplos fantasma — desaparecen cuando aparece la primera tarea
          real (porque isFullyEmpty pasa a false y este bloque entero no se
          renderiza). Labels abstractos a propósito: queremos mostrar el
          formato visual sin sugerir tareas concretas que el usuario podría
          confundir con datos reales. */}
      <Text style={[styles.exampleHeader, { color: c.textSubtle }]}>
        ASÍ SE VERÁN TUS TAREAS
      </Text>
      <View style={styles.exampleList}>
        <ExampleTaskCard label="Ejemplo · Tarea de prioridad alta" priority="Alta" colorScheme={scheme} />
        <ExampleTaskCard label="Ejemplo · Tarea de prioridad media" priority="Media" colorScheme={scheme} />
        <ExampleTaskCard label="Ejemplo · Tarea de prioridad baja" priority="Baja" colorScheme={scheme} />
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
  const accent = colorScheme === 'dark' ? '#94a3b8' : '#475569'; // slate, igual que TimelineTaskBlock
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
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickChipText: {
    fontSize: 12.5,
    fontWeight: '500',
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

  // CTA "Seleccionar varias" — pill discreta arriba de la lista. Cuando
  // selectionMode=true cambia a "Cancelar (N seleccionadas)".
  bulkCtaWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  bulkCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bulkCtaText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Bulk action bar — barra abajo con botones de category target.
  // Visible solo cuando hay al menos 1 seleccionada.
  bulkBar: {
    position: 'absolute',
    bottom: 8,
    left: Spacing.lg,
    right: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  bulkBarTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  bulkBarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  bulkBarBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkBarBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

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
