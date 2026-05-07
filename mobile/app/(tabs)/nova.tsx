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
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

// Pantalla Nova — chat con el asistente.
//
// Misma idea que la web: el usuario escribe, mandamos al backend
// /api/focus-assistant con el contexto de eventos+tareas, mostramos la
// respuesta. Por ahora sin location/profile/memories/behavior — el backend
// los acepta opcionales.
//
// Persistencia: sin cache local en Fase 2. Cuando el usuario sale del tab,
// el historial se mantiene en memoria del componente. Al matar la app se
// pierde — está OK por ahora; la web tampoco persistía hasta hace poco.

const SUGGESTED_PROMPTS = [
  '¿Qué tengo hoy?',
  'Crea una tarea para llamar a mamá mañana',
  'Resume mi semana',
  '¿Qué se me está olvidando?',
];

export default function NovaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Seed: cuando alguien navega a /nova?seed=...&autosubmit=1 (ej. desde el
  // FocusBar de Mi Día), prerrellenamos el draft y opcionalmente autosend.
  const params = useLocalSearchParams<{ seed?: string; autosubmit?: string }>();

  const { events } = useEvents('all');
  const tasks = useTasks();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Evita procesar el seed múltiples veces (re-render / re-focus).
  const seedConsumedRef = useRef<string | null>(null);

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
        // Construye historial desde el último estado (sin incluir el placeholder).
        const history = [...messages, userMsg];
        const reply = await sendNovaMessage({
          message: text,
          events,
          tasks: tasks.tasks,
          history,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: reply.message || '…', status: 'sent' as const }
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
    [draft, sending, events, tasks.tasks, messages],
  );

  // Auto-scroll cuando llega un mensaje nuevo
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // Procesa el seed (una sola vez) si vino por URL params. Si autosubmit=1,
  // dispara handleSend; si no, deja el draft pre-rellenado para que el usuario
  // edite antes de enviar.
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
            renderItem={({ item }) => <ChatBubble message={item} />}
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
