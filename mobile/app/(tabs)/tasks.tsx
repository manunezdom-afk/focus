import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { SectionHeader } from '@/components/SectionHeader';
import { TaskRow } from '@/components/TaskRow';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Task } from '@/src/data/types';
import { useTasks } from '@/src/data/useTasks';

type Section = { type: 'header'; title: string; count: number } | { type: 'task'; task: Task };

export default function TasksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const tasks = useTasks();
  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Particionamos en pendientes / completadas. La query ya las trae con
  // `done ASC, created_at DESC`, así que reordenar es O(n).
  const sections = useMemo<Section[]>(() => {
    const pending: Task[] = [];
    const done: Task[] = [];
    for (const t of tasks.tasks) {
      (t.done ? done : pending).push(t);
    }
    const out: Section[] = [];
    out.push({ type: 'header', title: 'Pendientes', count: pending.length });
    for (const t of pending) out.push({ type: 'task', task: t });
    if (done.length > 0) {
      out.push({ type: 'header', title: 'Completadas', count: done.length });
      for (const t of done) out.push({ type: 'task', task: t });
    }
    return out;
  }, [tasks.tasks]);

  async function handleAdd() {
    const label = draft.trim();
    if (!label || submitting) return;
    setSubmitting(true);
    const created = await tasks.addTask({ label });
    setSubmitting(false);
    if (created) {
      setDraft('');
      inputRef.current?.blur();
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }

  const showLoadingState = tasks.loading && tasks.tasks.length === 0;
  const showEmptyState = !tasks.loading && tasks.tasks.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        // 80 = altura aprox del tab bar nativo. Sin esto, en iOS el input se
        // pega al teclado y la tab bar lo tapa.
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.text }]}>Tareas</Text>
        </View>

        <View style={[styles.composer, { borderBottomColor: c.border, backgroundColor: c.background }]}>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleAdd}
            placeholder="Nueva tarea…"
            placeholderTextColor={c.textMuted}
            style={[
              styles.input,
              { backgroundColor: c.surface, borderColor: c.border, color: c.text },
            ]}
            autoCorrect
            autoCapitalize="sentences"
            returnKeyType="done"
            editable={!submitting}
            maxLength={200}
          />
          <Pressable
            onPress={handleAdd}
            disabled={submitting || !draft.trim()}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: c.primary,
                opacity: !draft.trim() || submitting ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Crear tarea"
          >
            <Text style={[styles.addButtonText, { color: c.onPrimary }]}>Añadir</Text>
          </Pressable>
        </View>

        {tasks.error ? (
          <ErrorBanner message="No pudimos sincronizar tus tareas." onRetry={tasks.refresh} />
        ) : null}

        {showLoadingState ? (
          <LoadingState />
        ) : showEmptyState ? (
          <EmptyState
            icon="checklist"
            title="Sin tareas todavía"
            description="Escribe arriba para crear tu primera, o pídele a Nova que te ayude."
          />
        ) : (
          <FlatList
            data={sections}
            keyExtractor={(item, idx) =>
              item.type === 'header' ? `h-${item.title}-${idx}` : item.task.id
            }
            renderItem={({ item }) =>
              item.type === 'header' ? (
                <SectionHeader title={item.title} count={item.count} />
              ) : (
                <View style={[styles.row, { backgroundColor: c.surface }]}>
                  <TaskRow
                    task={item.task}
                    onToggle={tasks.toggleTask}
                    onDelete={tasks.removeTask}
                  />
                </View>
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={tasks.refreshing}
                onRefresh={tasks.refresh}
                tintColor={c.text}
              />
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    minHeight: 44,
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { fontSize: 15, fontWeight: '600' },
  listContent: { paddingBottom: 32 },
  row: {},
});
