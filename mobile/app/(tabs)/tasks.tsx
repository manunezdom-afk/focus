import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { TaskRow } from '@/components/TaskRow';
import { Card } from '@/components/ui/Card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ProgressCard } from '@/components/ui/ProgressCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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

  function cycleCategory(id: string, current: string) {
    const idx = CATEGORIES.indexOf(current as Category);
    const next = CATEGORIES[(idx + 1) % CATEGORIES.length];
    void tasks.patchTask(id, { category: next });
  }

  const showLoadingState = tasks.loading && tasks.tasks.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
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
          {/* Header con título grande + chip "Nova, organízame" */}
          <ScreenHeader
            title="Tareas"
            rightAction={
              hasPendingToday ? (
                <PrimaryButton
                  label="Nova, organízame"
                  size="sm"
                  variant="tinted"
                  onPress={() => router.push('/nova')}
                />
              ) : null
            }
          />

          {/* Card de progreso de hoy */}
          {todayTasks.length > 0 ? (
            <View style={styles.progressWrap}>
              <ProgressCard done={todayDone} total={todayTasks.length} />
            </View>
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

          {!showLoadingState ? (
            <>
              {CATEGORIES.map((cat) => {
                const items = byCategory[cat];
                const pending = items.filter((t) => !t.done).length;
                const isAddOpenHere = showInput && addCategory === cat;
                return (
                  <View key={cat} style={styles.categoryWrap}>
                    {/* Header de sección con icon + label + count + (+) */}
                    <View style={styles.catHeader}>
                      <View style={styles.catLeft}>
                        <IconSymbol
                          name={CAT_ICONS[cat]}
                          size={16}
                          color={c.textMuted}
                        />
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
                          {
                            backgroundColor: pressed ? c.surfaceTint : 'transparent',
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Añadir tarea a ${CAT_LABELS[cat]}`}
                      >
                        <IconSymbol name="plus" size={16} color={c.primary} />
                      </Pressable>
                    </View>

                    {/* Lista o empty inline (botón con dashed border) */}
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
                        <View
                          style={[
                            styles.miniDot,
                            { backgroundColor: c.surfaceTint },
                          ]}
                        >
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

                    {/* Composer inline para esta categoría */}
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
                                      draftPriority === p
                                        ? c.surfaceTint
                                        : 'transparent',
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
                                {
                                  color: draft.trim() ? c.primary : c.textSubtle,
                                },
                              ]}
                            >
                              Añadir
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },

  progressWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  bannerWrap: { paddingHorizontal: Spacing.lg },

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
