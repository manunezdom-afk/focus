import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { CreateEventInput } from '@/src/data/events';
import { sendNovaMessage, type NovaActionShape } from '@/src/data/nova';
import type { CreateTaskInput } from '@/src/data/tasks';
import type { EventItem, Task } from '@/src/data/types';

// Seed: contador para que el padre pueda forzar pre-llenado del input
// (ej. al tocar un chip del empty state). Cada vez que `n` aumenta, el
// componente sustituye el draft por `text`. Con `n=0` no hay seed.
export type PlannerNovaSeed = { text: string; n: number };

type Props = {
  events: EventItem[];
  tasks: Task[];
  onAddEvent: (input: CreateEventInput) => Promise<EventItem | null>;
  onAddTask: (input: CreateTaskInput) => Promise<Task | null>;
  onRefresh: () => void;
  seed?: PlannerNovaSeed;
};

type ReplyState = {
  text: string;
  appliedActions: string[];
  isError: boolean;
};

// Extrae shape de evento desde una acción Nova. Tolerante a `a.event` o
// `a.payload.event`. Si la shape no es válida → null y no se aplica
// nada (no inventamos datos).
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

function describeApplied(a: NovaActionShape): string | null {
  const any = a as any;
  switch (a.type) {
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

export function PlannerNovaInput({
  events,
  tasks,
  onAddEvent,
  onAddTask,
  onRefresh,
  seed,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<ReplyState | null>(null);

  // Cada vez que el counter `n` cambia, sembramos el draft. Permite que
  // los chips del empty state pre-llenen el input sin forzar mount.
  useEffect(() => {
    if (seed && seed.n > 0 && seed.text) {
      setDraft(seed.text);
    }
  }, [seed?.n, seed?.text]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const res = await sendNovaMessage({
        message: text,
        events,
        tasks,
        history: [],
      });

      // Procesar SOLO acciones cuya shape reconocemos. Otras pasan al
      // chip-row sin aplicarse — el message text de Nova queda como
      // referencia para el usuario.
      const applied: string[] = [];
      const actions = Array.isArray(res.actions) ? res.actions : [];
      for (const a of actions) {
        if (a.type === 'add_event') {
          const input = tryEventFromAction(a);
          if (input) {
            void onAddEvent(input);
            const desc = describeApplied(a);
            if (desc) applied.push(desc);
          }
        } else if (a.type === 'add_task') {
          const input = tryTaskFromAction(a);
          if (input) {
            void onAddTask(input);
            const desc = describeApplied(a);
            if (desc) applied.push(desc);
          }
        }
      }

      // Refrescar por si Nova ejecutó algo server-side (delete/edit).
      onRefresh();

      setReply({
        text: res.message?.trim() || 'Listo.',
        appliedActions: applied,
        isError: false,
      });
      setDraft('');
    } catch (err: any) {
      setReply({
        text: err?.message ?? 'No pude responder. Intenta de nuevo.',
        appliedActions: [],
        isError: true,
      });
    } finally {
      setSending(false);
    }
  }, [draft, sending, events, tasks, onAddEvent, onAddTask, onRefresh]);

  const canSend = !!draft.trim() && !sending;

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputBar, { backgroundColor: c.surface, borderColor: c.border }]}>
        {/* Indicador izquierdo: círculo con ícono Nova. No es interactivo —
            solo señaliza visualmente que la barra es de Nova, paralelo al
            mic button del legacy (la voz es scope futuro). */}
        <View style={[styles.leftIndicator, { backgroundColor: c.surfaceTint }]}>
          <IconSymbol name="sparkles" size={14} color={c.primary} />
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder='Ej: "Agenda dentista el viernes a las 10"'
          placeholderTextColor={c.textSubtle}
          style={[styles.input, { color: c.text }]}
          multiline
          autoCorrect
          autoCapitalize="sentences"
          maxLength={2000}
          editable={!sending}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendBtn,
            { backgroundColor: c.primary, opacity: !canSend ? 0.35 : pressed ? 0.85 : 1 },
          ]}
          accessibilityLabel="Enviar a Nova"
          accessibilityRole="button"
        >
          {sending ? (
            <ActivityIndicator color={c.onPrimary} size="small" />
          ) : (
            <IconSymbol name="arrow.up" size={16} color={c.onPrimary} />
          )}
        </Pressable>
      </View>

      {reply ? (
        <View
          style={[
            styles.reply,
            {
              backgroundColor: c.surface,
              borderColor: reply.isError ? c.danger : c.border,
            },
          ]}
        >
          <Text style={[styles.replyTitle, { color: reply.isError ? c.danger : c.primary }]}>
            Nova
          </Text>
          <Text style={[styles.replyText, { color: c.text }]}>{reply.text}</Text>
          {reply.appliedActions.length > 0 ? (
            <View style={styles.chipsRow}>
              {reply.appliedActions.map((label, idx) => (
                <View
                  key={`${label}-${idx}`}
                  style={[styles.chip, { backgroundColor: c.primaryContainer }]}
                >
                  <Text style={[styles.chipText, { color: c.primary }]}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Pressable
            onPress={() => setReply(null)}
            hitSlop={10}
            style={styles.dismissBtn}
            accessibilityLabel="Cerrar respuesta"
            accessibilityRole="button"
          >
            <IconSymbol name="xmark" size={14} color={c.textSubtle} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 48,
  },
  leftIndicator: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 32,
    maxHeight: 120,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reply: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    paddingRight: Spacing.xl,
    gap: 6,
  },
  replyTitle: {
    ...Typography.micro,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  replyText: {
    ...Typography.body,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  chipText: {
    ...Typography.micro,
    fontWeight: '700',
  },
  dismissBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
