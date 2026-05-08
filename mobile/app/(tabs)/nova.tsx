import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/ChatBubble';
import { SwipeNavigator } from '@/components/navigation/SwipeNavigator';
import { NovaOrb } from '@/components/nova/NovaOrb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/src/auth/AuthProvider';
import type { CreateEventInput, EventPatch } from '@/src/data/events';
import { newClientId } from '@/src/data/ids';
import { sendNovaMessage, type ChatMessage } from '@/src/data/nova';
import { loadNovaHistory, saveNovaHistory } from '@/src/data/novaPersist';
import { consumeNovaSeed } from '@/src/data/novaSeedStore';
import type { CreateTaskInput } from '@/src/data/tasks';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';
import { expandRecurrence } from '@/src/utils/expandRecurrence';

// Pantalla Nova — corazón inteligente de Focus.
//
// Estructura: header con NovaOrb + título → empty state (orb hero + chips)
// O FlatList de chat → composer fijo abajo.
//
// Action processor: aplica add_event/add_task con shape válida via hooks
// existentes (useEvents.addEvent / useTasks.addTask). Otros tipos quedan
// como mensaje sin acción aplicada — no inventamos datos. Tras cada
// respuesta refrescamos events+tasks por si Nova ejecutó algo server-side
// (delete/edit que no procesamos en cliente todavía).

type SuggestedPrompt = {
  label: string;
  icon: 'sparkles' | 'calendar' | 'checklist';
};

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { label: 'Organiza mi día', icon: 'sparkles' },
  { label: 'Agenda gym mañana a las 7', icon: 'calendar' },
  { label: 'Reserva 2h enfocadas esta tarde', icon: 'checklist' },
  { label: '¿Qué tengo pendiente?', icon: 'sparkles' },
];

// Lectura defensiva de las acciones que devuelve Nova. Tolerantes a
// `a.event` (legacy) o `a.payload.event` (forma nueva). Si la shape es
// inválida, devuelven null y NO se aplica nada.
function tryEventFromAction(a: any): CreateEventInput | null {
  const e = a?.event ?? a?.payload?.event ?? a?.data?.event;
  if (!e || typeof e.title !== 'string' || !e.title.trim()) return null;
  return {
    title: e.title,
    date: typeof e.date === 'string' ? e.date : null,
    time: typeof e.time === 'string' ? e.time : null,
    description: typeof e.description === 'string' ? e.description : undefined,
    section: typeof e.section === 'string' ? e.section : undefined,
  };
}

function tryTaskFromAction(a: any): CreateTaskInput | null {
  const t = a?.task ?? a?.payload?.task ?? a?.data?.task;
  if (!t || typeof t.label !== 'string' || !t.label.trim()) return null;
  return {
    label: t.label,
    priority: t.priority,
    category: typeof t.category === 'string' ? t.category : 'hoy',
  };
}

// Convierte `updates` de edit_event a EventPatch tipado seguro.
function tryEventPatchFromAction(a: any): EventPatch | null {
  const u = a?.updates ?? a?.payload?.updates;
  if (!u || typeof u !== 'object') return null;
  const patch: EventPatch = {};
  if (typeof u.title === 'string' && u.title.trim()) patch.title = u.title;
  if (typeof u.date === 'string') patch.date = u.date;
  if (u.date === null) patch.date = null;
  if (typeof u.time === 'string') patch.time = u.time;
  if (u.time === null) patch.time = null;
  if (typeof u.description === 'string') patch.description = u.description;
  if (u.description === null) patch.description = null;
  if (typeof u.section === 'string') patch.section = u.section;
  if (typeof u.featured === 'boolean') patch.featured = u.featured;
  return Object.keys(patch).length > 0 ? patch : null;
}

function describeApplied(action: any, eventTitleById?: Map<string, string>, taskLabelById?: Map<string, string>): string | null {
  const any = action as any;
  switch (action.type) {
    case 'add_event': {
      const title = any?.event?.title ?? any?.payload?.event?.title;
      return title ? `Agregado: ${title}` : 'Evento agregado';
    }
    case 'add_recurring_event': {
      const title = any?.event?.title ?? any?.payload?.event?.title;
      return title ? `Recurrente agregado: ${title}` : 'Eventos recurrentes agregados';
    }
    case 'add_task': {
      const label = any?.task?.label ?? any?.payload?.task?.label;
      return label ? `Tarea agregada: ${label}` : 'Tarea agregada';
    }
    case 'edit_event': {
      const id = any?.id ?? any?.payload?.id;
      const t = id ? eventTitleById?.get(id) : undefined;
      return t ? `Evento actualizado: ${t}` : 'Evento actualizado';
    }
    case 'delete_event': {
      const id = any?.id ?? any?.payload?.id;
      const t = id ? eventTitleById?.get(id) : undefined;
      return t ? `Evento eliminado: ${t}` : 'Evento eliminado';
    }
    case 'mark_task_done':
    case 'toggle_task': {
      const id = any?.id ?? any?.payload?.id;
      const l = id ? taskLabelById?.get(id) : undefined;
      return l ? `Tarea marcada: ${l}` : 'Tarea marcada';
    }
    case 'delete_task': {
      const id = any?.id ?? any?.payload?.id;
      const l = id ? taskLabelById?.get(id) : undefined;
      return l ? `Tarea eliminada: ${l}` : 'Tarea eliminada';
    }
    default:
      return null;
  }
}

const DESTRUCTIVE_TYPES = new Set(['delete_event', 'delete_task']);

// Resumen humano de una lista de acciones destructivas para el Alert de
// confirmación. Devuelve "Eliminar 2 eventos y 1 tarea?" o similar.
function destructiveSummary(actions: any[], eventTitleById: Map<string, string>, taskLabelById: Map<string, string>): string {
  const events = actions.filter((a) => a.type === 'delete_event');
  const tasks = actions.filter((a) => a.type === 'delete_task');
  const parts: string[] = [];
  if (events.length === 1) {
    const id = events[0].id ?? events[0].payload?.id;
    const title = id ? eventTitleById.get(id) : undefined;
    parts.push(title ? `el evento "${title}"` : '1 evento');
  } else if (events.length > 1) {
    parts.push(`${events.length} eventos`);
  }
  if (tasks.length === 1) {
    const id = tasks[0].id ?? tasks[0].payload?.id;
    const label = id ? taskLabelById.get(id) : undefined;
    parts.push(label ? `la tarea "${label}"` : '1 tarea');
  } else if (tasks.length > 1) {
    parts.push(`${tasks.length} tareas`);
  }
  return parts.join(' y ');
}

export default function NovaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { user } = useAuth();
  const userId = user?.id ?? null;

  const events = useEvents('all');
  const tasks = useTasks();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Cargar historial persistido al montar (una vez por userId). Si falla,
  // dejamos messages vacío — el usuario no ve nada raro.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setHistoryLoaded(true);
      return;
    }
    void (async () => {
      const restored = await loadNovaHistory(userId);
      if (cancelled) return;
      setMessages(restored);
      setHistoryLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persistir cambios de messages con un pequeño debounce — solo después
  // de que cargamos el historial inicial (si no, el primer effect con
  // messages=[] sobrescribiría el historial real).
  useEffect(() => {
    if (!userId || !historyLoaded) return;
    const t = setTimeout(() => {
      void saveNovaHistory(userId, messages);
    }, 300);
    return () => clearTimeout(t);
  }, [userId, historyLoaded, messages]);

  // Consume seed cross-tab al ganar foco. Si Calendario/Tareas/Mi Día
  // dejaron un texto pendiente, lo metemos en el composer para que el
  // usuario revise y mande (no auto-enviamos por seguridad).
  useFocusEffect(
    useCallback(() => {
      const seed = consumeNovaSeed();
      if (seed) {
        setDraft(seed);
        // Pequeño delay para que el TextInput esté montado.
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    }, []),
  );

  // Focus glow animado en el composer (mismo patrón que PlannerNovaInput).
  const focus = useSharedValue(0);
  const animatedComposerStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.07 + focus.value * 0.13,
    shadowRadius: 14 + focus.value * 10,
  }));

  // Aplica una lista de acciones contra los hooks de tasks/events. Las
  // destructivas ya pasaron por confirmación antes de llegar acá.
  const applyActions = useCallback(
    async (actions: any[]): Promise<string[]> => {
      const applied: string[] = [];
      const eventTitleById = new Map(events.events.map((e) => [e.id, e.title]));
      const taskLabelById = new Map(tasks.tasks.map((t) => [t.id, t.label]));

      for (const a of actions) {
        if (a.type === 'add_event') {
          const input = tryEventFromAction(a);
          if (input) {
            await events.addEvent(input);
            const d = describeApplied(a);
            if (d) applied.push(d);
          }
        } else if (a.type === 'add_recurring_event') {
          const expanded = expandRecurrence(a);
          for (const ev of expanded) await events.addEvent(ev);
          if (expanded.length > 0) {
            const d = describeApplied(a);
            if (d) applied.push(`${d} (${expanded.length})`);
          }
        } else if (a.type === 'add_task') {
          const input = tryTaskFromAction(a);
          if (input) {
            await tasks.addTask(input);
            const d = describeApplied(a);
            if (d) applied.push(d);
          }
        } else if (a.type === 'edit_event') {
          const id = a?.id ?? a?.payload?.id;
          const patch = tryEventPatchFromAction(a);
          if (id && patch) {
            await events.patchEvent(id, patch);
            const d = describeApplied(a, eventTitleById, taskLabelById);
            if (d) applied.push(d);
          }
        } else if (a.type === 'delete_event') {
          const id = a?.id ?? a?.payload?.id;
          if (id) {
            await events.removeEvent(id);
            const d = describeApplied(a, eventTitleById, taskLabelById);
            if (d) applied.push(d);
          }
        } else if (a.type === 'mark_task_done' || a.type === 'toggle_task') {
          const id = a?.id ?? a?.payload?.id;
          if (id) {
            await tasks.toggleTask(id);
            const d = describeApplied(a, eventTitleById, taskLabelById);
            if (d) applied.push(d);
          }
        } else if (a.type === 'delete_task') {
          const id = a?.id ?? a?.payload?.id;
          if (id) {
            await tasks.removeTask(id);
            const d = describeApplied(a, eventTitleById, taskLabelById);
            if (d) applied.push(d);
          }
        }
        // 'remember' aún no soportado en mobile (requiere endpoint o
        // tabla user_memories — ver mobile/docs/NOVA_TASKS_PENDING.md).
      }
      return applied;
    },
    [events, tasks],
  );

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? draft).trim();
      if (!text || sending) return;

      const userMsg: ChatMessage = {
        id: newClientId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
        status: 'sent',
      };
      const placeholder: ChatMessage = {
        id: newClientId(),
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, userMsg, placeholder]);
      setDraft('');
      setSending(true);
      if (Platform.OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      try {
        const history = [...messages, userMsg];
        const reply = await sendNovaMessage({
          message: text,
          events: events.events,
          tasks: tasks.tasks,
          history,
        });

        const actions = Array.isArray(reply.actions) ? reply.actions : [];
        const safeActions = actions.filter(
          (a) => !DESTRUCTIVE_TYPES.has(a?.type),
        );
        const destructive = actions.filter((a) => DESTRUCTIVE_TYPES.has(a?.type));

        // Aplicar primero las acciones seguras (constructivas/edit/toggle).
        const applied = await applyActions(safeActions);

        // Render del mensaje del assistant — antes de pedir confirmación
        // para que el usuario lea el contexto que acompaña la propuesta.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  content: reply.message?.trim() || '…',
                  status: 'sent' as const,
                  appliedActions: applied.length > 0 ? applied : undefined,
                }
              : m,
          ),
        );

        // Propose mode para destructivas: una sola confirmación cubre todas.
        if (destructive.length > 0) {
          const eventTitleById = new Map(events.events.map((e) => [e.id, e.title]));
          const taskLabelById = new Map(tasks.tasks.map((t) => [t.id, t.label]));
          const summary = destructiveSummary(destructive, eventTitleById, taskLabelById);
          Alert.alert(
            '¿Confirmar eliminación?',
            `Vas a eliminar ${summary}. Esto no se puede deshacer.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    const dApplied = await applyActions(destructive);
                    if (dApplied.length > 0) {
                      // Aumentar el chip del último mensaje con las eliminaciones.
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === placeholder.id
                            ? {
                                ...m,
                                appliedActions: [
                                  ...(m.appliedActions ?? []),
                                  ...dApplied,
                                ],
                              }
                            : m,
                        ),
                      );
                    }
                  })();
                },
              },
            ],
          );
        }

        // Refrescar para reflejar cambios reales (en caso de algún server-side).
        void events.refresh();
        void tasks.refresh();
      } catch (err: any) {
        const errCode = err?.code as string | undefined;
        const errText: string =
          err?.message || 'No pude responder. Intenta de nuevo en un momento.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: errText, status: 'error' as const, errorCode: errCode }
              : m,
          ),
        );
        if (Platform.OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } finally {
        setSending(false);
      }
    },
    [draft, sending, messages, events, tasks, applyActions],
  );

  // Auto-scroll al final cuando llega un mensaje nuevo.
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Retry: re-enviar el último mensaje del usuario si la última respuesta
  // del assistant fue error. El botón aparece debajo del último bubble.
  const lastMsg = messages[messages.length - 1];
  const lastIsError = lastMsg?.role === 'assistant' && lastMsg.status === 'error';
  const handleRetry = useCallback(() => {
    if (sending) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    // Quitar el último assistant fallido para no acumular ruido.
    setMessages((prev) => prev.filter((m) => m.id !== lastMsg.id));
    void handleSend(lastUser.content);
  }, [sending, messages, lastMsg, handleSend]);

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Hero halo — patrón compartido con Mi Día y Calendario. */}
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

      <SwipeNavigator currentTab="nova">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {/* Header: orb compacto + título Nova + tagline */}
        <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
          <View style={styles.headerRow}>
            <NovaOrb size={36} ambient={false} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>Nova</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Tu asistente para organizar el día.
              </Text>
            </View>
          </View>
        </Animated.View>

        {isEmpty ? (
          <Animated.ScrollView
            entering={FadeInDown.delay(80).duration(420)}
            contentContainerStyle={styles.emptyContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.emptyHero}>
              <NovaOrb size={64} ambient breathing />
              <Text style={[styles.emptyTitle, { color: c.text }]}>¿Qué necesitas?</Text>
              <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
                Te ayudo a agendar, mover o limpiar tu día. Siempre confirmas antes de aplicar.
              </Text>
            </View>

            <View style={styles.suggestionsCol}>
              {SUGGESTED_PROMPTS.map((s, idx) => (
                <Animated.View
                  key={s.label}
                  entering={FadeInDown.delay(220 + idx * 60).duration(320)}
                >
                  <Pressable
                    onPress={() => void handleSend(s.label)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      {
                        backgroundColor: c.surface,
                        borderColor: c.border,
                        opacity: pressed ? 0.7 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Enviar a Nova: ${s.label}`}
                  >
                    <View style={[styles.suggestionIcon, { backgroundColor: c.primaryContainer }]}>
                      <IconSymbol name={s.icon} size={16} color={c.primary} />
                    </View>
                    <Text style={[styles.suggestionText, { color: c.text }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <IconSymbol name="chevron.right" size={14} color={c.textSubtle} />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.ScrollView>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={
              lastIsError ? (
                <View style={styles.retryWrap}>
                  <Pressable
                    onPress={handleRetry}
                    disabled={sending}
                    style={({ pressed }) => [
                      styles.retryBtn,
                      {
                        backgroundColor: c.surface,
                        borderColor: c.border,
                        opacity: sending ? 0.5 : pressed ? 0.7 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Reintentar mensaje"
                  >
                    <IconSymbol name="arrow.up" size={14} color={c.primary} />
                    <Text style={[styles.retryText, { color: c.primary }]}>Reintentar</Text>
                  </Pressable>
                </View>
              ) : null
            }
          />
        )}

        {/* Composer — sparkles indicator + TextInput + send con focus glow */}
        <Animated.View
          style={[
            styles.composer,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              shadowColor: '#5b5ef5',
            },
            animatedComposerStyle,
          ]}
        >
          <View style={[styles.leftIndicator, { backgroundColor: c.surfaceTint }]}>
            <IconSymbol name="sparkles" size={14} color={c.primary} />
          </View>
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void handleSend()}
            placeholder="Escribe a Nova…"
            placeholderTextColor={c.textSubtle}
            style={[styles.input, { color: c.text }]}
            multiline
            autoCorrect
            autoCapitalize="sentences"
            returnKeyType="send"
            blurOnSubmit
            editable={!sending}
            maxLength={2000}
            onFocus={() => {
              focus.value = withTiming(1, { duration: 220 });
            }}
            onBlur={() => {
              focus.value = withTiming(0, { duration: 220 });
            }}
          />
          <Pressable
            onPress={() => void handleSend()}
            disabled={sending || !draft.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: c.primary,
                opacity: !draft.trim() || sending ? 0.35 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar a Nova"
          >
            {sending ? (
              <ActivityIndicator color={c.onPrimary} size="small" />
            ) : (
              <IconSymbol name="arrow.up" size={18} color={c.onPrimary} />
            )}
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
      </SwipeNavigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },

  // Hero halo (mismos números que Mi Día / Calendar)
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

  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },

  // Empty state — orb grande centrado + título + chips de prompts
  emptyContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  emptyDesc: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },

  suggestionsCol: {
    gap: 10,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 14,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },

  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },

  retryWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    alignItems: 'flex-start',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Composer — mismo lenguaje visual que PlannerNovaInput
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 54,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
  },
  leftIndicator: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
