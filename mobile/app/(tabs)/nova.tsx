import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import type { CreateEventInput } from '@/src/data/events';
import { newClientId } from '@/src/data/ids';
import { sendNovaMessage, type ChatMessage } from '@/src/data/nova';
import type { CreateTaskInput } from '@/src/data/tasks';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

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

function describeApplied(action: any): string | null {
  const any = action as any;
  switch (action.type) {
    case 'add_event': {
      const title = any?.event?.title ?? any?.payload?.event?.title;
      return title ? `Agregado: ${title}` : 'Evento agregado';
    }
    case 'add_task': {
      const label = any?.task?.label ?? any?.payload?.task?.label;
      return label ? `Tarea agregada: ${label}` : 'Tarea agregada';
    }
    default:
      return null;
  }
}

export default function NovaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const events = useEvents('all');
  const tasks = useTasks();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Focus glow animado en el composer (mismo patrón que PlannerNovaInput).
  const focus = useSharedValue(0);
  const animatedComposerStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.07 + focus.value * 0.13,
    shadowRadius: 14 + focus.value * 10,
  }));

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

        // Procesar acciones seguras y construir labels de confirmación.
        const applied: string[] = [];
        const actions = Array.isArray(reply.actions) ? reply.actions : [];
        for (const a of actions) {
          if (a.type === 'add_event') {
            const input = tryEventFromAction(a);
            if (input) {
              void events.addEvent(input);
              const desc = describeApplied(a);
              if (desc) applied.push(desc);
            }
          } else if (a.type === 'add_task') {
            const input = tryTaskFromAction(a);
            if (input) {
              void tasks.addTask(input);
              const desc = describeApplied(a);
              if (desc) applied.push(desc);
            }
          }
        }

        // Refrescar para reflejar cambios server-side (delete/edit aún no
        // procesados en cliente).
        void events.refresh();
        void tasks.refresh();

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
    [draft, sending, messages, events, tasks],
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
            <NovaOrb size={48} ambient={false} />
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
              <NovaOrb size={88} ambient />
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
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  emptyHero: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
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
