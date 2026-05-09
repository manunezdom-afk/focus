import { router, Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientNova } from '@/components/nova/AmbientNova';
import { InboxEmpty } from '@/components/inbox/InboxEmpty';
import { SuggestionCard } from '@/components/inbox/SuggestionCard';
import { LoadingState } from '@/components/LoadingState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSuggestions } from '@/src/data/useSuggestions';
import type { Suggestion } from '@/src/data/types';

// Pantalla "Bandeja de Nova". Stack route (no tab) accesible desde el icono
// tray.fill del iconRow en Mi Día. Razón de no ser tab: 5 tabs ya es el
// límite iOS HIG y la Bandeja vive bien como push de stack — además queda
// ergonómicamente cerca del lugar donde se ve el contexto del día.
//
// Patrón visual:
//   - Header con back + título + badge de count.
//   - AmbientNova de fondo (igual que Mi Día) — la Bandeja es una extensión
//     de la conversación con Nova, no una pantalla aparte fría.
//   - Lista de SuggestionCard con swipe + CTAs + long-press para snooze.
//   - Empty state celebratorio (Sunsama style).
//   - Pull-to-refresh dispara generación + re-fetch.
//
// Errores se muestran como banner discreto que se puede limpiar con tap.
export default function InboxScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const inbox = useSuggestions();

  const handleApprove = useCallback(
    (id: string) => {
      void inbox.approve(id).then((res) => {
        if (!res.ok && (res as { code?: string }).code === 'quota_exceeded') {
          Alert.alert('Sin cuota', (res as { error: string }).error);
        }
      });
    },
    [inbox],
  );

  const handleReject = useCallback(
    (id: string) => {
      void inbox.reject(id);
    },
    [inbox],
  );

  const handleLongPress = useCallback(
    (suggestion: Suggestion) => {
      const options = ['Posponer 1 hora', 'Posponer 3 horas', 'Posponer hasta mañana', 'Posponer 1 semana', 'No volver a sugerir esto', 'Cancelar'];
      const cancelButtonIndex = options.length - 1;
      const dismissIndex = options.length - 2;

      const handleSelect = (idx: number) => {
        if (idx === cancelButtonIndex) return;
        if (idx === dismissIndex) {
          void inbox.reject(suggestion.id, { dismissKind: true });
          return;
        }
        const presets = ['1h', '3h', 'tomorrow', 'next_week'] as const;
        const preset = presets[idx];
        if (preset) void inbox.snooze(suggestion.id, preset);
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex,
            destructiveButtonIndex: dismissIndex,
            title: suggestion.preview_title,
          },
          handleSelect,
        );
      } else {
        // Android fallback: Alert con buttons. Limitado a 3 botones — para
        // la lista completa esperamos hasta que tengamos un BottomSheet
        // multiplataforma propio. Por ahora ofrecemos los 2 más comunes.
        Alert.alert(
          suggestion.preview_title,
          'Elige una acción',
          [
            { text: 'Posponer 1h', onPress: () => void inbox.snooze(suggestion.id, '1h') },
            { text: 'Posponer hasta mañana', onPress: () => void inbox.snooze(suggestion.id, 'tomorrow') },
            { text: 'No volver a sugerir', style: 'destructive', onPress: () => void inbox.reject(suggestion.id, { dismissKind: true }) },
            { text: 'Cancelar', style: 'cancel' },
          ],
        );
      }
    },
    [inbox],
  );

  const showEmpty = !inbox.loading && inbox.suggestions.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <AmbientNova scheme={scheme} level="low" />

      {/* Header con back + título + badge */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}
          accessibilityLabel="Volver"
          accessibilityRole="button"
        >
          <IconSymbol name="chevron.left" size={22} color={c.text} />
        </Pressable>
        <View style={styles.titleCol}>
          <Text style={[styles.title, { color: c.text }]}>Bandeja</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={1}>
            {inbox.pendingCount === 0
              ? 'Sin sugerencias por ahora'
              : `${inbox.pendingCount} ${inbox.pendingCount === 1 ? 'sugerencia' : 'sugerencias'} de Nova`}
          </Text>
        </View>
      </View>

      {/* Banner de error: discreto, tocar limpia */}
      {inbox.error && !inbox.loading ? (
        <Pressable
          onPress={inbox.clearError}
          style={({ pressed }) => [
            styles.errorChip,
            {
              backgroundColor: scheme === 'dark' ? 'rgba(239,68,68,0.15)' : '#fef2f2',
              borderColor: scheme === 'dark' ? 'rgba(239,68,68,0.4)' : '#fecaca',
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Error: ${inbox.error}. Toca para descartar.`}
        >
          <IconSymbol name="exclamationmark.circle" size={12} color="#dc2626" />
          <Text style={styles.errorChipText} numberOfLines={2}>
            {inbox.error}
          </Text>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scroll, showEmpty && styles.scrollEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={inbox.refreshing}
            onRefresh={inbox.refresh}
            tintColor={c.text}
          />
        }
      >
        {inbox.loading ? (
          <LoadingState label="Buscando sugerencias..." />
        ) : showEmpty ? (
          <InboxEmpty />
        ) : (
          <View style={styles.list}>
            {inbox.suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                applying={inbox.isApplying(s.id)}
                onApprove={handleApprove}
                onReject={handleReject}
                onLongPress={handleLongPress}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
    maxWidth: '90%',
  },
  errorChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    flex: 1,
  },
  scroll: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing['3xl'],
  },
  scrollEmpty: {
    flexGrow: 1,
  },
  list: {
    paddingTop: Spacing.xs,
  },
});
