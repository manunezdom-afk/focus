import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatBubble } from '@/components/ChatBubble';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { newClientId } from '@/src/data/ids';
import { sendNovaMessage, type ChatMessage } from '@/src/data/nova';
import {
  applyNovaActions,
  describeApplied,
  type AppliedItem,
  type NovaAction,
} from '@/src/data/novaActions';
import { useAppPreferences } from '@/src/data/preferences';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';
import { useUserMemories } from '@/src/data/useUserMemories';
import { useUserProfile } from '@/src/data/useUserProfile';

// Pantalla Nova — chat completo con el asistente.
//
// Port de src/components/NovaWidget.jsx (1234 lines) adaptado a RN/Expo:
// - Persistencia del historial: legacy usa sessionStorage, mobile usa
//   AsyncStorage. Misma key 'nova_history' para que se pueda compartir
//   conceptualmente, aunque por plataforma viven separadas.
// - Action processor: cuando Nova devuelve `actions[]`, las aplicamos
//   localmente (crea/borra eventos+tareas) y mostramos chips de "Aplicada:
//   X" anclados al mensaje del asistente. Espejo de FocusBar legacy.
// - Contexto rico: incluye profile + memories + novaPersonality en el
//   payload. Sin geolocation/behavior por ahora (mobile no los tiene).

const STORAGE_KEY = 'nova_history';
const STORAGE_LIMIT = 60; // últimos 60 mensajes (legacy guarda 40)

const SUGGESTED_PROMPTS = [
  '¿Qué tengo hoy?',
  'Crea una tarea para llamar a mamá mañana',
  'Resume mi semana',
  '¿Qué se me está olvidando?',
];

// Mensaje extendido en mobile: incluye actions aplicadas asociadas a este turn,
// para mostrar chips junto a la burbuja de assistant.
type ChatMessageExt = ChatMessage & {
  applied?: AppliedItem[];
};

export default function NovaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMessageExt>>(null);

  const params = useLocalSearchParams<{ seed?: string; autosubmit?: string }>();

  const events = useEvents('all');
  const tasks = useTasks();
  const { profile } = useUserProfile();
  const { memories } = useUserMemories();
  const { prefs } = useAppPreferences();

  const [messages, setMessages] = useState<ChatMessageExt[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const seedConsumedRef = useRef<string | null>(null);

  // Hidrata el historial desde AsyncStorage al montar. Los messages persisten
  // entre sesiones, hasta que el usuario haga "limpiar" o expiren.
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ChatMessageExt[];
            if (Array.isArray(parsed)) setMessages(parsed.slice(-STORAGE_LIMIT));
          } catch {
            // si el JSON está corrupto, descartamos sin romper la pantalla
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      mounted = false;
    };
  }, []);

  // Persiste el historial cada vez que cambia (recortado al límite).
  useEffect(() => {
    if (!hydrated) return; // evita escribir el array vacío inicial sobre datos guardados
    const payload = messages.slice(-STORAGE_LIMIT);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [messages, hydrated]);

  const handleSend = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? draft).trim();
      if (!text || sending) return;

      const userMsg: ChatMessageExt = {
        id: newClientId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
        status: 'sent',
      };
      const placeholder: ChatMessageExt = {
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
          profile,
          memories,
          novaPersonality: prefs.novaPersonality,
        });
        // Aplica las actions del response al estado local (mismo patrón que
        // Mi Día). Después rendereamos chips "Aplicada: X" en la burbuja.
        const actions = (reply.raw as any)?.actions as NovaAction[] | undefined;
        const { applied, failed } = await applyNovaActions(actions ?? [], {
          events: events.events,
          tasks: tasks.tasks,
          addEvent: events.addEvent,
          removeEvent: events.removeEvent,
          addTask: tasks.addTask,
          toggleTask: tasks.toggleTask,
          removeTask: tasks.removeTask,
          patchTask: tasks.patchTask,
        });
        if (failed.length > 0) {
          console.warn('[Nova] actions failed', failed);
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? {
                  ...m,
                  content: reply.message || '…',
                  status: 'sent' as const,
                  applied: applied.length > 0 ? applied : undefined,
                }
              : m,
          ),
        );
        if (applied.length > 0) {
          // Si Nova creó cosas reales, refrescamos para que las pantallas
          // hermanas (Mi Día / Calendario / Tareas) muestren los nuevos items.
          void events.refresh();
          void tasks.refresh();
          if (Platform.OS === 'ios') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
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
    [draft, sending, events, tasks, profile, memories, prefs.novaPersonality, messages],
  );

  // Auto-scroll cuando llega un mensaje nuevo
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Procesa el seed (una sola vez) si vino por URL params.
  useEffect(() => {
    const seed = typeof params.seed === 'string' ? params.seed : null;
    if (!seed) return;
    if (seedConsumedRef.current === seed) return;
    seedConsumedRef.current = seed;
    const autosubmit = params.autosubmit === '1' || params.autosubmit === 'true';
    if (autosubmit) {
      void handleSend(seed);
    } else {
      setDraft(seed);
    }
  }, [params.seed, params.autosubmit, handleSend]);

  const isEmpty = messages.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View
              style={[
                styles.headerIcon,
                { backgroundColor: c.surfaceTint, borderColor: c.border },
              ]}
            >
              <IconSymbol name="sparkles" size={22} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.text }]}>Nova</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Tu asistente para organizar el día.
              </Text>
            </View>
          </View>
        </View>

        {isEmpty ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: c.text }]}>¿En qué te ayudo?</Text>
            <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
              Pregúntame por tu día, pídeme que cree una tarea, o cuéntame algo y lo organizo.
            </Text>
            <View style={styles.suggestionsCol}>
              {SUGGESTED_PROMPTS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSend(s)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Probar: ${s}`}
                >
                  <Text style={[styles.suggestionText, { color: c.text }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View>
                <ChatBubble message={item} />
                {/* Chips de actions aplicadas, sólo en mensajes assistant */}
                {item.role === 'assistant' && item.applied && item.applied.length > 0 ? (
                  <View style={styles.chipsRow}>
                    {item.applied.map((a, idx) => (
                      <View
                        key={`${item.id}-${idx}`}
                        style={[
                          styles.chip,
                          { backgroundColor: c.surfaceTint, borderColor: c.border },
                        ]}
                      >
                        <IconSymbol name="sparkles" size={11} color={c.primary} />
                        <Text style={[styles.chipText, { color: c.primary }]}>
                          {describeApplied(a)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        <View
          style={[
            styles.composer,
            { borderTopColor: c.border, backgroundColor: c.background },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => handleSend()}
            placeholder="Escribe a Nova…"
            placeholderTextColor={c.textMuted}
            style={[
              styles.input,
              { backgroundColor: c.surface, borderColor: c.border, color: c.text },
            ]}
            multiline
            autoCorrect
            autoCapitalize="sentences"
            returnKeyType="send"
            blurOnSubmit
            editable={!sending}
            maxLength={2000}
          />
          <Pressable
            onPress={() => handleSend()}
            disabled={sending || !draft.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: c.primary,
                opacity: !draft.trim() || sending ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar a Nova"
          >
            <IconSymbol name="arrow.up" size={20} color={c.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.title1 },
  subtitle: { ...Typography.caption },

  emptyContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyTitle: { ...Typography.title2 },
  emptyDesc: { ...Typography.body },
  suggestionsCol: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  suggestion: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { ...Typography.body },

  listContent: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.lg + 4,
    marginTop: -2,
    marginBottom: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    ...Typography.body,
    minHeight: 44,
    maxHeight: 140,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
