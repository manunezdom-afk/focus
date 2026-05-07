import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Componente dev-only de comparación. Renderiza la app legacy (Vite/Capacitor)
// dentro de un WebView para usarla como referencia visual al portar pantallas
// a React Native. Persiste el origen LAN en AsyncStorage para no pedirlo cada
// vez. Auth dentro del WebView es independiente de la sesión Expo (cookies
// propias del WebView). No se importa desde código de producción.

const STORAGE_KEY = 'focus.dev.legacyOrigin';

const ROUTE_PRESETS: Array<{ label: string; path: string }> = [
  { label: 'Mi día (Planner)', path: '/' },
  { label: 'Calendario', path: '/calendar' },
  { label: 'Tareas', path: '/tasks' },
  { label: 'Nova', path: '/nova' },
  { label: 'Ajustes', path: '/settings' },
  { label: 'Day', path: '/day' },
  { label: 'Memory', path: '/memory' },
];

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function joinUrl(origin: string, path: string): string {
  if (!origin) return '';
  const o = trimTrailingSlash(origin);
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

export function LegacyMirror() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const webRef = useRef<WebView>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  const [path, setPath] = useState<string>('/');
  const [draftOrigin, setDraftOrigin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!mounted) return;
      if (stored && stored.trim().length > 0) {
        setOrigin(stored.trim());
        setDraftOrigin(stored.trim());
      } else {
        setDraftOrigin('http://192.168.1.10:5173');
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const url = useMemo(() => (origin ? joinUrl(origin, path) : ''), [origin, path]);

  const saveOrigin = useCallback(async (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) {
      Alert.alert('URL vacía', 'Pega la URL LAN del Vite legacy (ej. http://192.168.1.10:5173)');
      return;
    }
    if (!/^https?:\/\//.test(cleaned)) {
      Alert.alert(
        'URL inválida',
        'Debe empezar con http:// o https://. Para LAN local usa http://<IP>:5173',
      );
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, cleaned);
    setOrigin(cleaned);
    setHasError(null);
  }, []);

  const clearOrigin = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setOrigin(null);
    setDraftOrigin('http://192.168.1.10:5173');
    setHasError(null);
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  // Setup: pedir origen una vez. Persiste en AsyncStorage.
  if (!origin) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.flex, { backgroundColor: c.background }]}
      >
        <ScrollView contentContainerStyle={styles.setupContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: c.text }]}>Migration Mirror</Text>
          <Text style={[styles.body, { color: c.textMuted }]}>
            Indica la URL LAN del Vite de la app legacy. Para levantarlo en LAN:
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.code, { color: c.text }]}>
              cd ~/Developer/focus
            </Text>
            <Text style={[styles.code, { color: c.text }]}>
              npm run dev -- --host 0.0.0.0
            </Text>
          </View>
          <Text style={[styles.body, { color: c.textMuted }]}>
            Vite imprimirá una URL "Network:" con tu IP LAN. Pégala aquí (ej.{' '}
            <Text style={{ color: c.primary }}>http://192.168.1.10:5173</Text>).
          </Text>
          <TextInput
            value={draftOrigin}
            onChangeText={setDraftOrigin}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://192.168.1.10:5173"
            placeholderTextColor={c.textSubtle}
            style={[
              styles.input,
              { color: c.text, backgroundColor: c.surface, borderColor: c.border },
            ]}
          />
          <Pressable
            onPress={() => void saveOrigin(draftOrigin)}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: pressed ? c.primaryPressed : c.primary },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: c.onPrimary }]}>Guardar y cargar</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {ROUTE_PRESETS.map((preset) => {
            const isActive = preset.path === path;
            return (
              <Pressable
                key={preset.path}
                onPress={() => setPath(preset.path)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isActive ? c.primary : c.surfaceMuted,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? c.onPrimary : c.text },
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.metaRow}>
          <Text
            style={[styles.urlText, { color: c.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {url}
          </Text>
          <Pressable
            onPress={() => webRef.current?.reload()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityLabel="Recargar"
          >
            <IconSymbol name="arrow.up" size={16} color={c.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => void clearOrigin()}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityLabel="Cambiar URL"
          >
            <IconSymbol name="gearshape.fill" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      </View>

      {hasError ? (
        <View style={[styles.errorBox, { backgroundColor: c.surface, borderColor: c.danger }]}>
          <Text style={[styles.errorText, { color: c.danger }]}>{hasError}</Text>
        </View>
      ) : null}

      <WebView
        ref={webRef}
        source={{ uri: url }}
        style={styles.webview}
        onError={(e) => setHasError(e.nativeEvent.description)}
        onHttpError={(e) =>
          setHasError(`HTTP ${e.nativeEvent.statusCode} ${e.nativeEvent.description ?? ''}`)
        }
        onLoadStart={() => setHasError(null)}
        // Dev local sin SSL: hay que permitir HTTP plano
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        decelerationRate="normal"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        // No requerimos JS bridge en Fase 1; queda como referencia visual.
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.center, { backgroundColor: c.background }]}>
            <ActivityIndicator color={c.primary} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  h1: {
    ...Typography.title1,
    fontSize: 24,
  },
  body: {
    ...Typography.body,
  },
  codeBlock: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    ...Typography.body,
  },
  primaryBtn: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...Typography.bodyStrong,
  },
  toolbar: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  chipsRow: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  chipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  urlText: {
    flex: 1,
    ...Typography.micro,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    margin: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    ...Typography.caption,
  },
  webview: {
    flex: 1,
  },
});
