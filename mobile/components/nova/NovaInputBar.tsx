import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MicWaveform } from '@/components/nova/MicWaveform';
import { NovaOrb } from '@/components/nova/NovaOrb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useWhisperDictation } from '@/src/lib/useWhisperDictation';
import type { CreateEventInput } from '@/src/data/events';
import { sendNovaMessage, type NovaActionShape } from '@/src/data/nova';
import { analyzePhoto } from '@/src/data/photo';
import { setNovaSeed } from '@/src/data/novaSeedStore';
import type { CreateTaskInput } from '@/src/data/tasks';
import { todayISO } from '@/src/data/today';
import type { EventItem, Task } from '@/src/data/types';
import { useMemories } from '@/src/data/useMemories';
import { useUserProfile } from '@/src/data/useUserProfile';

// Contexto por pantalla — Nova ajusta placeholder y agrega un hint sutil
// al prompt cuando lo que el usuario dice es ambiguo. La intención es que
// "comprar leche" desde Tareas se cree como tarea, mientras que "comprar
// leche a las 5pm" desde Calendario se cree como evento (el system
// prompt sigue mandando para el caso obvio; el hint solo desempata).
export type NovaInputContext =
  | { type: 'day' }
  | { type: 'calendar'; selectedDate?: string }
  | { type: 'tasks' }
  | { type: 'free' };

export type NovaInputSeed = { text: string; n: number };

type Props = {
  events: EventItem[];
  tasks: Task[];
  onAddEvent: (input: CreateEventInput) => Promise<EventItem | null>;
  onAddTask: (input: CreateTaskInput) => Promise<Task | null>;
  // Acciones destructivas: si el padre las pasa, NovaInputBar las ejecuta
  // cuando Nova devuelve delete_event/delete_task. Sin esto, "borra el
  // recordatorio" desde Mi Día se ignora silenciosamente — bug visible
  // al usuario que dice "Nova no hizo nada".
  onRemoveEvent?: (id: string) => Promise<void>;
  onRemoveTask?: (id: string) => Promise<void>;
  onRefresh: () => void;
  context: NovaInputContext;
  seed?: NovaInputSeed;
};

type ReplyState = {
  text: string;
  appliedActions: string[];
  isError: boolean;
};

function placeholderFor(ctx: NovaInputContext): string {
  switch (ctx.type) {
    case 'tasks':
      return 'Añade una tarea, prioriza, organiza…';
    case 'calendar':
      return 'Agenda un evento, mueve, libera tiempo…';
    case 'day':
      return 'Pídele a Nova que organice tu día…';
    case 'free':
    default:
      return 'Dile a Nova qué necesitas…';
  }
}

// Inyecta una pista contextual al user message. El system prompt del
// backend ya tiene reglas claras sobre tarea vs evento; el hint solo
// rompe el empate cuando lo que dice el usuario es ambiguo.
function buildContextualPrompt(ctx: NovaInputContext, message: string): string {
  switch (ctx.type) {
    case 'tasks':
      return `[Vista actual: Tareas. Si lo siguiente es ambiguo entre tarea y evento, prefiere crearlo como tarea sin hora.] ${message}`;
    case 'calendar': {
      const date = ctx.selectedDate;
      return date
        ? `[Vista actual: Calendario, día ${date}. Si lo siguiente es ambiguo, prefiere crearlo como evento ese día.] ${message}`
        : `[Vista actual: Calendario. Si lo siguiente es ambiguo, prefiere crearlo como evento.] ${message}`;
    }
    case 'day':
      return `[Vista actual: Mi Día (hoy).] ${message}`;
    case 'free':
    default:
      return message;
  }
}

function tryEventFromAction(a: any): CreateEventInput | null {
  const e = a?.event ?? a?.payload?.event ?? a?.data?.event;
  if (!e || typeof e.title !== 'string' || !e.title.trim()) return null;
  const rawDate = typeof e.date === 'string' && e.date.trim() ? e.date : null;
  const rawTime = typeof e.time === 'string' && e.time.trim() ? e.time : null;
  // Si Nova omite date pero hay time o es un "Recordatorio:" → default hoy.
  // Sin esto, el evento se inserta con date=null, fetchTodayEvents filtra
  // por date=todayISO() y nunca aparece en Mi Día (chip dice "Agregado"
  // pero el timeline está vacío — bug visible al usuario).
  const isReminder = /^recordatorio[:\s]/i.test(e.title);
  const date = rawDate ?? ((rawTime || isReminder) ? todayISO() : null);
  return {
    title: e.title,
    date,
    time: rawTime,
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

// Input persistente y contextual de Nova. Se renderiza directamente; el
// caller decide el posicionamiento (las pantallas lo anclan abajo encima
// de la tab bar via wrapper con `position: absolute`).
export function NovaInputBar({
  events,
  tasks,
  onAddEvent,
  onAddTask,
  onRemoveEvent,
  onRemoveTask,
  onRefresh,
  context,
  seed,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const userProfile = useUserProfile();
  const memoriesHook = useMemories();
  const seedText = seed?.text;
  const seedN = seed?.n;
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<ReplyState | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  // Composer multilínea inteligente — el TextInput crece con el contenido
  // hasta MAX_INPUT_HEIGHT y a partir de ahí scrollea internamente. Sin
  // esto, frases largas (típicas en dictado) se cortaban a la derecha en
  // la barra "lineal" anterior.
  const MIN_INPUT_HEIGHT = 22;
  const MAX_INPUT_HEIGHT = 132; // ~6 líneas a lineHeight 22
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);

  // Dictado con OpenAI Whisper (mismo motor que ChatGPT Voice).
  // Graba audio con expo-av → sube a /api/transcribe → Whisper → texto.
  const dictation = useWhisperDictation({
    onFinal: (text) => {
      if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    },
    onVolume: (level) => setMicLevel(level),
  });

  function handleMicPress() {
    if (dictation.state === 'recording') {
      dictation.stop();
      return;
    }
    if (dictation.state === 'processing' || dictation.state === 'requesting') return;
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void dictation.start();
  }

  // Mostrar Alert solo si el error es de permisos (no de red/Whisper que
  // son transitorios y se muestran en el propio botón).
  useEffect(() => {
    if (dictation.state === 'error' && dictation.errorMessage?.includes('Ajustes')) {
      Alert.alert('Micrófono desactivado', dictation.errorMessage);
    }
  }, [dictation.state, dictation.errorMessage]);

  // Seed cross-tab (consume del store global) + seed via prop (chip del
  // empty state) ambos pre-llenan el input.
  useEffect(() => {
    if (seedN && seedN > 0 && seedText) {
      setDraft(seedText);
    }
  }, [seedN, seedText]);

  const focus = useSharedValue(0);
  const sendScale = useSharedValue(1);
  const animatedBarStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.07 + focus.value * 0.08,
    shadowRadius: 12 + focus.value * 5,
  }));
  const sendBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  // Si hay reply, lo limpia tras 6s para que la barra no quede ocupada.
  useEffect(() => {
    if (!reply) return;
    const t = setTimeout(() => setReply(null), 6000);
    return () => clearTimeout(t);
  }, [reply]);

  const processPhoto = useCallback(async (uri: string) => {
    if (analyzingPhoto) return;
    setAnalyzingPhoto(true);
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      const base64 = compressed.base64 ?? '';
      if (!base64) throw new Error('No pude leer la imagen.');

      const detected = await analyzePhoto({ base64, mediaType: 'image/jpeg' });

      if (detected.length === 0) {
        setReply({ text: 'No detecté ningún evento en esa foto. Intenta con otra más clara.', appliedActions: [], isError: false });
        return;
      }

      const applied: string[] = [];
      for (const ev of detected) {
        const created = await onAddEvent({
          title: ev.title,
          date: ev.date ?? null,
          time: ev.time ?? null,
          description: ev.description ?? undefined,
        });
        if (created) applied.push(`Agregado: ${ev.title}`);
      }
      onRefresh();

      const summary = detected.length === 1
        ? 'Detecté 1 evento en la foto y lo agregué a tu calendario.'
        : `Detecté ${detected.length} eventos en la foto y los agregué.`;
      setReply({ text: summary, appliedActions: applied, isError: false });
    } catch (err: any) {
      setReply({ text: err?.message ?? 'No pude analizar la foto.', appliedActions: [], isError: true });
      if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      setAnalyzingPhoto(false);
    }
  }, [analyzingPhoto, onAddEvent, onRefresh]);

  const launchPhotoSource = useCallback(async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso de cámara requerido', 'Activa el acceso a la cámara en Ajustes para que Nova analice fotos de tu agenda.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
        if (!result.canceled && result.assets[0]?.uri) void processPhoto(result.assets[0].uri);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso de galería requerido', 'Activa el acceso a Fotos en Ajustes para que Nova analice imágenes.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 1,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        if (!result.canceled && result.assets[0]?.uri) void processPhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No pude abrir el selector de imagen.');
    }
  }, [processPhoto]);

  // Tap = abrir cámara directo (estilo WhatsApp/ChatGPT). El menú raro
  // "Tomar foto / Elegir de galería" lo elimino — para galería el usuario
  // puede usar el share sheet de Fotos hacia Focus en el futuro.
  const openPhotoSource = useCallback(() => {
    if (analyzingPhoto || sending) return;
    void launchPhotoSource('camera');
  }, [analyzingPhoto, sending, launchPhotoSource]);

  // Long-press = galería (alternativa avanzada).
  const openLibrary = useCallback(() => {
    if (analyzingPhoto || sending) return;
    void launchPhotoSource('library');
  }, [analyzingPhoto, sending, launchPhotoSource]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const finalMessage = buildContextualPrompt(context, text);
      const res = await sendNovaMessage({
        message: finalMessage,
        events,
        tasks,
        history: [],
        // Mismo contexto que la pantalla principal de Nova: pasamos las
        // memorias del usuario para que las respuestas cortas del mini-input
        // (Mi Día / Calendario / Tareas) tengan el mismo grado de contexto.
        memories: memoriesHook.memories,
        novaPersonality: userProfile.profile?.novaPersonality ?? 'focus',
      });

      const applied: string[] = [];
      const failed: string[] = [];
      const actions = Array.isArray(res.actions) ? res.actions : [];
      for (const a of actions) {
        if (a.type === 'add_event') {
          const input = tryEventFromAction(a);
          if (input) {
            // Await + check return: addEvent devuelve null si createEvent
            // falló (RLS, network, validación). Así el chip "Agregado" solo
            // aparece cuando el evento realmente quedó en Supabase.
            const created = await onAddEvent(input);
            const desc = describeApplied(a);
            if (created) {
              if (desc) applied.push(desc);
            } else if (desc) {
              failed.push(desc.replace(/^Agregado: /, ''));
            }
          }
        } else if (a.type === 'add_task') {
          const input = tryTaskFromAction(a);
          if (input) {
            const created = await onAddTask(input);
            const desc = describeApplied(a);
            if (created) {
              if (desc) applied.push(desc);
            } else if (desc) {
              failed.push(desc.replace(/^Tarea agregada: /, ''));
            }
          }
        } else if (a.type === 'delete_event' && onRemoveEvent) {
          const any = a as any;
          const id = String(any.id ?? any.payload?.id ?? any.event?.id ?? '');
          if (id) {
            try {
              await onRemoveEvent(id);
              // Buscar título para el chip; si no encontramos, usamos genérico
              const ev = events.find((e) => e.id === id);
              applied.push(ev?.title ? `Eliminado: ${ev.title}` : 'Evento eliminado');
            } catch {
              failed.push('No pude eliminar el evento');
            }
          }
        } else if (a.type === 'delete_task' && onRemoveTask) {
          const any = a as any;
          const id = String(any.id ?? any.payload?.id ?? any.task?.id ?? '');
          if (id) {
            try {
              await onRemoveTask(id);
              const t = tasks.find((tk) => tk.id === id);
              applied.push(t?.label ? `Eliminada: ${t.label}` : 'Tarea eliminada');
            } catch {
              failed.push('No pude eliminar la tarea');
            }
          }
        }
      }

      onRefresh();

      const baseText = res.message?.trim() || 'Listo.';
      const failNote = failed.length > 0
        ? `\n⚠ No pude guardar: ${failed.join(', ')}`
        : '';

      setReply({
        text: baseText + failNote,
        appliedActions: applied,
        isError: failed.length > 0 && applied.length === 0,
      });
      setDraft('');
      // Tras enviar, la barra vuelve a 1 línea — onContentSizeChange tarda
      // un frame en reportar el contenido vacío y se vería un "salto" de
      // alto si no lo forzamos acá.
      setInputHeight(MIN_INPUT_HEIGHT);
    } catch (err: any) {
      setReply({
        text: err?.message ?? 'No pude responder. Intenta de nuevo.',
        appliedActions: [],
        isError: true,
      });
    } finally {
      setSending(false);
    }
  }, [draft, sending, events, tasks, onAddEvent, onAddTask, onRefresh, context, userProfile.profile, memoriesHook.memories]);

  // Tap en el chevron del reply o en el bubble: salta a la pantalla Nova
  // con el último mensaje + reply ya enviado (vía seedStore). Permite
  // continuar la conversación sin perder contexto.
  const continueInNova = useCallback(() => {
    if (!reply) return;
    setNovaSeed(draft || reply.text);
    setReply(null);
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    router.push('/(tabs)/nova');
  }, [reply, draft]);

  const canSend = !!draft.trim() && !sending;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {reply ? (
        <View
          style={[
            styles.reply,
            {
              backgroundColor: c.surface,
              borderColor: reply.isError ? c.danger : c.border,
              shadowColor: reply.isError ? c.danger : c.primary,
            },
          ]}
        >
          <View style={styles.replyHeader}>
            <View style={styles.replyHeaderLeft}>
              <NovaOrb size={16} ambient={false} breathing={false} />
              <Text
                style={[styles.replyTitle, { color: reply.isError ? c.danger : c.primary }]}
              >
                Nova
              </Text>
            </View>
            <Pressable
              onPress={() => setReply(null)}
              hitSlop={10}
              accessibilityLabel="Cerrar respuesta"
              accessibilityRole="button"
            >
              <IconSymbol name="xmark" size={13} color={c.textSubtle} />
            </Pressable>
          </View>
          <Text style={[styles.replyText, { color: c.text }]} numberOfLines={3}>
            {reply.text}
          </Text>
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
            onPress={continueInNova}
            hitSlop={6}
            style={({ pressed }) => [
              styles.continueLink,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continuar conversación con Nova"
          >
            <Text style={[styles.continueLinkText, { color: c.primary }]}>
              Continuar en Nova →
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.inputBar,
          { backgroundColor: c.surface, borderColor: c.border },
          animatedBarStyle,
        ]}
      >
        {/* Identidad visual de Nova — orbe real con gradiente azul orbital,
            no un ícono plano. Mismo componente que el hero del Nova screen,
            tamaño 26 para que entre cómodo en la barra. Los spots de color
            siguen orbitando aunque la barra esté en reposo (breathing). */}
        <View style={styles.leftIndicator}>
          <NovaOrb size={26} ambient={false} breathing active={dictation.state === 'recording'} />
        </View>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            // Si el usuario borró todo el texto, devolvemos la barra a su
            // alto mínimo. onContentSizeChange tarda un frame en reportar
            // contenido vacío y se notaría como "barra grande con un solo
            // caret".
            if (!t) setInputHeight(MIN_INPUT_HEIGHT);
          }}
          placeholder={placeholderFor(context)}
          placeholderTextColor={c.textSubtle}
          style={[
            styles.input,
            {
              color: c.text,
              height: inputHeight,
            },
          ]}
          multiline
          // Solo permite scroll interno cuando el contenido excedió el alto
          // máximo. Sin esto, RN deja scrollear "vacío" y la UX se siente
          // rota cuando hay solo una línea.
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          textAlignVertical="top"
          onContentSizeChange={(e) => {
            const next = e.nativeEvent.contentSize.height;
            const clamped = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, next));
            // Evita re-renders en cada keystroke si el alto no cambió.
            setInputHeight((prev) => (Math.abs(prev - clamped) < 0.5 ? prev : clamped));
          }}
          autoCorrect
          autoCapitalize="sentences"
          maxLength={2000}
          editable={!sending}
          onFocus={() => {
            focus.value = withTiming(1, { duration: 160 });
          }}
          onBlur={() => {
            focus.value = withTiming(0, { duration: 160 });
          }}
        />
        <Pressable
          onPress={openPhotoSource}
          onLongPress={openLibrary}
          delayLongPress={350}
          hitSlop={6}
          disabled={analyzingPhoto || sending}
          style={({ pressed }) => [
            styles.cameraBtn,
            {
              opacity: (analyzingPhoto || sending) ? 0.35 : pressed ? 0.65 : 1,
              transform: [{ scale: pressed && !analyzingPhoto && !sending ? 0.92 : 1 }],
            },
          ]}
          accessibilityLabel="Tomar foto (mantén presionado para galería)"
          accessibilityRole="button"
        >
          {analyzingPhoto ? (
            <ActivityIndicator color={c.primary} size="small" />
          ) : (
            <IconSymbol name="camera.fill" size={16} color={c.textSubtle} />
          )}
        </Pressable>
        <Pressable
          onPress={handleMicPress}
          hitSlop={6}
          style={({ pressed }) => [
            dictation.state === 'recording' || dictation.state === 'processing'
              ? styles.micBtnListening
              : styles.micBtn,
            {
              backgroundColor: dictation.state === 'recording'
                ? '#dc2626'
                : dictation.state === 'processing'
                ? c.primary
                : 'transparent',
              opacity: pressed ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          accessibilityLabel={
            dictation.state === 'recording' ? 'Detener dictado' : 'Dictar a Nova'
          }
          accessibilityRole="button"
        >
          {dictation.state === 'requesting' ? (
            <ActivityIndicator color={c.primary} size="small" />
          ) : dictation.state === 'recording' ? (
            <MicWaveform level={micLevel} active color="#ffffff" />
          ) : dictation.state === 'processing' ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <IconSymbol name="mic.fill" size={16} color={c.textSubtle} />
          )}
        </Pressable>
        <Pressable
          onPress={send}
          disabled={!canSend}
          onPressIn={() => {
            sendScale.value = withTiming(0.94, { duration: 70 });
          }}
          onPressOut={() => {
            sendScale.value = withTiming(1, { duration: 110 });
          }}
          style={{ opacity: !canSend ? 0.35 : 1 }}
          accessibilityLabel="Enviar a Nova"
          accessibilityRole="button"
        >
          <Animated.View style={[sendBtnStyle]}>
            <LinearGradient
              colors={canSend ? ['#22d3ee', '#3b82f6', '#8b5cf6'] : [c.primary, c.primary, c.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              {sending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <IconSymbol name="arrow.up" size={16} color="#ffffff" />
              )}
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingBottom: 4,
  },
  reply: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 14,
    lineHeight: 20,
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
  continueLink: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  continueLinkText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Input bar — mismo lenguaje que PlannerNovaInput pero compacto para
  // anclaje. alignItems: 'flex-end' para que con texto multilínea los
  // botones queden anclados abajo y la zona de texto crezca hacia arriba.
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 48,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  leftIndicator: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cuando dictation.state === 'listening' el botón se expande para mostrar
  // el visualizador de barras estilo ChatGPT/Siri en su interior. Tap = stop.
  micBtnListening: {
    minWidth: 64,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
