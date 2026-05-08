import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
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
import type { CreateMemoryInput } from '@/src/data/memories';
import { sendNovaMessage, type ChatMessage } from '@/src/data/nova';
import { analyzePhoto } from '@/src/data/photo';
import { loadNovaHistory, saveNovaHistory } from '@/src/data/novaPersist';
import { consumeNovaSeed } from '@/src/data/novaSeedStore';
import type { CreateTaskInput } from '@/src/data/tasks';
import { useEvents } from '@/src/data/useEvents';
import { useMemories } from '@/src/data/useMemories';
import { useTasks } from '@/src/data/useTasks';
import { useUserProfile } from '@/src/data/useUserProfile';
import { expandRecurrence } from '@/src/utils/expandRecurrence';

// Pantalla Nova — corazón inteligente de Focus.
//
// Estructura: header con NovaOrb + título → empty state (orb hero + pills)
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

function formatContextDate(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const dayMonth = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dayMonth}`;
}

function useContextualPrompts(
  evts: import('@/src/data/types').EventItem[],
  tsks: import('@/src/data/types').Task[],
): SuggestedPrompt[] {
  return useMemo(() => {
    const hour = new Date().getHours();
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().split('T')[0];

    const pendingToday = tsks.filter((t) => !t.done && t.category === 'hoy');
    const todayEvts = evts.filter((e) => e.date === today);
    const tomorrowEvts = evts.filter((e) => e.date === tomorrowISO);

    const result: SuggestedPrompt[] = [];

    if (hour >= 5 && hour < 12) {
      if (pendingToday.length > 0) {
        result.push({ label: `Prioriza mis ${pendingToday.length} tareas de hoy`, icon: 'sparkles' });
      } else if (todayEvts.length > 0) {
        result.push({ label: `Repasa mis ${todayEvts.length} eventos de hoy`, icon: 'calendar' });
      } else {
        result.push({ label: 'Organiza mi mañana', icon: 'sparkles' });
      }
      result.push({ label: '2h enfocadas esta mañana', icon: 'checklist' });
    } else if (hour >= 12 && hour < 19) {
      if (pendingToday.length > 0) {
        const lbl = pendingToday[0].label;
        const short = lbl.length > 22 ? lbl.slice(0, 22) + '…' : lbl;
        result.push({ label: `¿Termino "${short}"?`, icon: 'sparkles' });
      } else {
        result.push({ label: '¿Qué me falta hoy?', icon: 'sparkles' });
      }
      result.push({ label: 'Mueve algo a mañana', icon: 'calendar' });
    } else {
      if (tomorrowEvts.length > 0) {
        result.push({ label: `Mañana tienes ${tomorrowEvts.length} eventos`, icon: 'calendar' });
      } else {
        result.push({ label: 'Planifica mi mañana', icon: 'calendar' });
      }
      result.push({ label: 'Cierra el día', icon: 'sparkles' });
    }

    result.push({ label: '¿Qué tengo esta semana?', icon: 'sparkles' });
    result.push({ label: 'Agenda algo nuevo', icon: 'calendar' });

    return result.slice(0, 4);
  }, [evts, tsks]);
}

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

function tryMemoryFromAction(a: any): CreateMemoryInput | null {
  const m = a?.memory ?? a?.payload?.memory ?? a?.data?.memory;
  if (!m || typeof m.content !== 'string' || !m.content.trim()) return null;
  return {
    category: typeof m.category === 'string' ? m.category : 'context',
    subject: typeof m.subject === 'string' ? m.subject : null,
    content: m.content,
    confidence: typeof m.confidence === 'string' ? m.confidence : 'medium',
    source: 'nova',
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
  const memoriesHook = useMemories();
  const userProfile = useUserProfile();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

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
        else if (a.type === 'remember') {
          const input = tryMemoryFromAction(a);
          if (input) {
            // Transparente: no agregamos chip de "guardado" para no
            // interrumpir; solo persiste para próximas conversaciones.
            await memoriesHook.addMemory(input);
          }
        }
      }
      return applied;
    },
    [events, tasks, memoriesHook],
  );

  // Procesa una foto: analiza con backend, muestra los eventos detectados
  // como bubble del assistant y pide confirmación al usuario antes de
  // crearlos en su calendario.
  const processPhoto = useCallback(
    async (uri: string) => {
      if (analyzingPhoto) return;
      setAnalyzingPhoto(true);

      // Insertar bubbles "Foto enviada" + placeholder de Nova mientras analiza.
      const userMsg: ChatMessage = {
        id: newClientId(),
        role: 'user',
        content: '📸 Foto de agenda enviada',
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
      if (Platform.OS === 'ios') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      try {
        // Comprimir antes de enviar — fotos de iPhone son 4-8 MB en raw,
        // base64 multiplica ~33% el tamaño. Comprimimos a max 1280px y
        // calidad 0.7 → ~200-400KB, suficiente para que el modelo lea.
        const compressed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1280 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        const base64 = compressed.base64 ?? '';
        if (!base64) throw new Error('No pude leer la imagen.');

        const detected = await analyzePhoto({ base64, mediaType: 'image/jpeg' });

        if (detected.length === 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === placeholder.id
                ? {
                    ...m,
                    content: 'No detecté ningún evento en esa foto. Probá con otra más clara.',
                    status: 'sent' as const,
                  }
                : m,
            ),
          );
          return;
        }

        const summary = detected
          .map(
            (e, i) =>
              `${i + 1}. ${e.title}${e.time ? ` · ${e.time}` : ''}${e.date ? ` · ${e.date}` : ''}`,
          )
          .join('\n');
        const human =
          detected.length === 1
            ? `Encontré 1 evento en la foto:\n${summary}\n\n¿Lo agrego al calendario?`
            : `Encontré ${detected.length} eventos en la foto:\n${summary}\n\n¿Los agrego al calendario?`;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: human, status: 'sent' as const }
              : m,
          ),
        );

        Alert.alert(
          '¿Agregar al calendario?',
          detected.length === 1
            ? `Voy a agregar "${detected[0].title}".`
            : `Voy a agregar ${detected.length} eventos detectados en la foto.`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Agregar',
              onPress: () => {
                void (async () => {
                  const applied: string[] = [];
                  for (const ev of detected) {
                    const created = await events.addEvent({
                      title: ev.title,
                      date: ev.date ?? null,
                      time: ev.time ?? null,
                      description: ev.description ?? undefined,
                    });
                    if (created) applied.push(`Agregado: ${ev.title}`);
                  }
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholder.id
                        ? { ...m, appliedActions: applied.length > 0 ? applied : undefined }
                        : m,
                    ),
                  );
                })();
              },
            },
          ],
        );
      } catch (err: any) {
        const msg: string = err?.message || 'No pude analizar la foto.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === placeholder.id
              ? { ...m, content: msg, status: 'error' as const, errorCode: err?.code }
              : m,
          ),
        );
        if (Platform.OS === 'ios') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } finally {
        setAnalyzingPhoto(false);
      }
    },
    [analyzingPhoto, events],
  );

  // Pide permisos y abre cámara o galería.
  const launchPicker = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permiso de cámara requerido',
              'Activa el acceso a la cámara en Ajustes para que Nova analice fotos de tu agenda.',
            );
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 1,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            void processPhoto(result.assets[0].uri);
          }
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permiso de galería requerido',
              'Activa el acceso a Fotos en Ajustes para que Nova analice fotos de tu agenda.',
            );
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            quality: 1,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
          if (!result.canceled && result.assets[0]?.uri) {
            void processPhoto(result.assets[0].uri);
          }
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'No pude abrir el selector de imagen.');
      }
    },
    [processPhoto],
  );

  const openPhotoSource = useCallback(() => {
    if (analyzingPhoto || sending) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) void launchPicker('camera');
          else if (idx === 2) void launchPicker('library');
        },
      );
    } else {
      // Android: Alert con dos opciones.
      Alert.alert('Foto de agenda', '¿De dónde tomamos la foto?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cámara', onPress: () => void launchPicker('camera') },
        { text: 'Galería', onPress: () => void launchPicker('library') },
      ]);
    }
  }, [analyzingPhoto, sending, launchPicker]);

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
          memories: memoriesHook.memories,
          history,
          novaPersonality: userProfile.profile?.novaPersonality ?? 'focus',
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
  const suggestedPrompts = useContextualPrompts(events.events, tasks.tasks);
  const pendingTodayCount = useMemo(
    () => tasks.tasks.filter((t) => !t.done && t.category === 'hoy').length,
    [tasks.tasks],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Fondo con dos halos de color suave — indigo arriba-izq, violeta abajo-der */}
      <View style={styles.bgLayer} pointerEvents="none">
        <View
          style={[
            styles.bgSpot1,
            {
              backgroundColor: c.primaryContainer,
              opacity: scheme === 'dark' ? 0.5 : 0.6,
            },
          ]}
        />
        <View
          style={[
            styles.bgSpot2,
            {
              backgroundColor: scheme === 'dark' ? '#164e63' : '#cffafe',
              opacity: scheme === 'dark' ? 0.5 : 0.65,
            },
          ]}
        />
      </View>

      <SwipeNavigator currentTab="nova">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {/* Barra de contexto mínima — fecha + estado del día */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.contextBar}>
          <Text style={[styles.contextDate, { color: c.text }]}>{formatContextDate()}</Text>
          <Text style={[styles.contextSub, { color: c.textMuted }]}>
            {pendingTodayCount > 0
              ? `${pendingTodayCount} tarea${pendingTodayCount > 1 ? 's' : ''} pendiente${pendingTodayCount > 1 ? 's' : ''}`
              : 'Día despejado'}
          </Text>
        </Animated.View>

        {isEmpty ? (
          <View style={styles.emptyArea}>
            <Animated.View
              entering={FadeInDown.delay(120).duration(380)}
              style={styles.pillsWrap}
            >
              {suggestedPrompts.map((s, idx) => (
                <Animated.View
                  key={s.label}
                  entering={FadeInDown.delay(160 + idx * 55).duration(300)}
                >
                  <Pressable
                    onPress={() => void handleSend(s.label)}
                    style={({ pressed }) => [
                      styles.pill,
                      {
                        backgroundColor: pressed ? c.primaryContainer : c.surface,
                        borderColor: pressed ? c.primary : c.border,
                        opacity: pressed ? 0.9 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Enviar a Nova: ${s.label}`}
                  >
                    <IconSymbol name={s.icon} size={13} color={c.primary} />
                    <Text style={[styles.pillText, { color: c.text }]} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </Animated.View>
          </View>
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

        {/* Compositor — orbe de Nova integrado a la izquierda, glass translúcido */}
        <Animated.View
          style={[
            styles.composer,
            {
              backgroundColor:
                scheme === 'dark' ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.90)',
              borderColor:
                scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(200,210,255,0.7)',
              shadowColor: '#2563eb',
            },
            animatedComposerStyle,
          ]}
        >
          {/* Orbe: toca para poner foco; pulsa más rápido cuando el usuario escribe */}
          <Pressable
            onPress={() => inputRef.current?.focus()}
            hitSlop={8}
            style={styles.orbBtn}
            accessibilityLabel="Escribe a Nova"
            accessibilityRole="button"
          >
            <NovaOrb size={28} ambient={false} active={draft.length > 0 || sending} />
          </Pressable>

          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void handleSend()}
            placeholder="Dime qué necesitas…"
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

          {/* Cámara — icono discreto para digitalizar notas/post-its */}
          <Pressable
            onPress={openPhotoSource}
            disabled={analyzingPhoto || sending}
            hitSlop={10}
            style={({ pressed }) => [
              styles.cameraBtn,
              { opacity: analyzingPhoto || sending ? 0.3 : pressed ? 0.5 : 0.45 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Digitalizar nota o post-it"
          >
            {analyzingPhoto ? (
              <ActivityIndicator color={c.primary} size="small" />
            ) : (
              <IconSymbol name="camera" size={15} color={c.textSubtle} />
            )}
          </Pressable>

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

  // Fondo: dos halos de color grandes y suaves
  bgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bgSpot1: {
    position: 'absolute',
    top: -80,
    left: -100,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  bgSpot2: {
    position: 'absolute',
    bottom: 60,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },

  // Barra de contexto mínima — fecha + estado
  contextBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: 2,
  },
  contextDate: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  contextSub: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Empty state — pills flotando en el espacio abierto
  emptyArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
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
  orbBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
  },
  cameraBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
