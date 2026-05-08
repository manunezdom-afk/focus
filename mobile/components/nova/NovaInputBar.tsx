import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
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
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useDictation } from '@/src/lib/useDictation';
import type { CreateEventInput } from '@/src/data/events';
import { sendNovaMessage, type NovaActionShape } from '@/src/data/nova';
import { analyzePhoto } from '@/src/data/photo';
import { setNovaSeed } from '@/src/data/novaSeedStore';
import type { CreateTaskInput } from '@/src/data/tasks';
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

// Input persistente y contextual de Nova. Se renderiza directamente; el
// caller decide el posicionamiento (las pantallas lo anclan abajo encima
// de la tab bar via wrapper con `position: absolute`).
export function NovaInputBar({
  events,
  tasks,
  onAddEvent,
  onAddTask,
  onRefresh,
  context,
  seed,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const userProfile = useUserProfile();
  const memoriesHook = useMemories();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<ReplyState | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);

  // Dictado real on-device via expo-speech-recognition (iOS Speech).
  // El texto final se appendea al draft (con espacio si ya hay algo).
  // Si el módulo nativo no está linkeado o el permiso fue denegado,
  // mostramos un Alert con instrucciones — no fingimos grabación.
  const dictation = useDictation({
    onPartial: () => {
      // No mostramos partials en el mini bar para no parpadear el placeholder.
      // El texto final reemplaza/extiende el draft cuando llega.
    },
    onFinal: (text) => {
      if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    },
  });

  function handleMicPress() {
    if (!dictation.available) {
      Alert.alert(
        'Dictado no disponible',
        'Reinstala la app desde Xcode (mobile/ios/Focus.xcworkspace) para activar el módulo de voz.',
        [{ text: 'Entendido', style: 'default' }],
      );
      return;
    }
    if (dictation.state === 'denied') {
      Alert.alert(
        'Activa el micrófono en Ajustes para dictarle a Nova',
        'iOS recuerda tu rechazo previo. Abre Ajustes del sistema para permitir el micrófono y el reconocimiento de voz.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: dictation.openSystemSettings },
        ],
      );
      return;
    }
    if (dictation.state === 'listening') {
      dictation.stop();
      return;
    }
    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void dictation.start();
  }

  // Mostrar Alert si hay error transitorio del motor de voz.
  useEffect(() => {
    if (dictation.state === 'error' && dictation.errorMessage) {
      Alert.alert('No pude acceder al micrófono', dictation.errorMessage);
    }
  }, [dictation.state, dictation.errorMessage]);

  // Seed cross-tab (consume del store global) + seed via prop (chip del
  // empty state) ambos pre-llenan el input.
  useEffect(() => {
    if (seed && seed.n > 0 && seed.text) {
      setDraft(seed.text);
    }
  }, [seed?.n, seed?.text]);

  const focus = useSharedValue(0);
  const sendScale = useSharedValue(1);
  const animatedBarStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.07 + focus.value * 0.13,
    shadowRadius: 14 + focus.value * 10,
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

  const openPhotoSource = useCallback(() => {
    if (analyzingPhoto || sending) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Tomar foto', 'Elegir de galería'], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) void launchPhotoSource('camera');
          else if (idx === 2) void launchPhotoSource('library');
        },
      );
    } else {
      Alert.alert('Foto para Nova', '¿Desde dónde?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cámara', onPress: () => void launchPhotoSource('camera') },
        { text: 'Galería', onPress: () => void launchPhotoSource('library') },
      ]);
    }
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
        <Animated.View
          entering={FadeIn.duration(220)}
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
            <Text
              style={[styles.replyTitle, { color: reply.isError ? c.danger : c.primary }]}
            >
              Nova
            </Text>
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
            style={({ pressed }) => [styles.continueLink, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Continuar conversación con Nova"
          >
            <Text style={[styles.continueLinkText, { color: c.primary }]}>
              Continuar en Nova →
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.inputBar,
          { backgroundColor: c.surface, borderColor: c.border },
          animatedBarStyle,
        ]}
      >
        <View style={[styles.leftIndicator, { backgroundColor: c.surfaceTint }]}>
          <IconSymbol name="sparkles" size={14} color={c.primary} />
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholderFor(context)}
          placeholderTextColor={c.textSubtle}
          style={[styles.input, { color: c.text }]}
          multiline
          autoCorrect
          autoCapitalize="sentences"
          maxLength={2000}
          editable={!sending}
          onFocus={() => {
            focus.value = withTiming(1, { duration: 220 });
          }}
          onBlur={() => {
            focus.value = withTiming(0, { duration: 220 });
          }}
        />
        <Pressable
          onPress={openPhotoSource}
          hitSlop={6}
          disabled={analyzingPhoto || sending}
          style={({ pressed }) => [
            styles.cameraBtn,
            { opacity: (analyzingPhoto || sending) ? 0.35 : pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel="Enviar foto a Nova"
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
            styles.micBtn,
            {
              backgroundColor: dictation.state === 'listening' ? '#dc2626' : 'transparent',
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityLabel={
            dictation.state === 'listening' ? 'Detener dictado' : 'Dictar a Nova'
          }
          accessibilityRole="button"
        >
          {dictation.state === 'requesting' ? (
            <ActivityIndicator color={c.primary} size="small" />
          ) : (
            <IconSymbol
              name="mic.fill"
              size={16}
              color={dictation.state === 'listening' ? '#ffffff' : c.textSubtle}
            />
          )}
        </Pressable>
        <Pressable
          onPress={send}
          disabled={!canSend}
          onPressIn={() => {
            sendScale.value = withSpring(0.86, { damping: 10, stiffness: 500, mass: 0.4 });
          }}
          onPressOut={() => {
            sendScale.value = withSpring(1, { damping: 12, stiffness: 400, mass: 0.4 });
          }}
          style={{ opacity: !canSend ? 0.35 : 1 }}
          accessibilityLabel="Enviar a Nova"
          accessibilityRole="button"
        >
          <Animated.View style={[styles.sendBtn, { backgroundColor: c.primary }, sendBtnStyle]}>
            {sending ? (
              <ActivityIndicator color={c.onPrimary} size="small" />
            ) : (
              <IconSymbol name="arrow.up" size={16} color={c.onPrimary} />
            )}
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

  // Input bar — mismo lenguaje que PlannerNovaInput pero compacto para anclaje.
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 5,
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
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 28,
    maxHeight: 100,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 15,
    lineHeight: 20,
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
});
