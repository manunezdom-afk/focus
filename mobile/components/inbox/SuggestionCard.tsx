import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { GeminiSurface } from '@/components/ui/GeminiSurface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Suggestion } from '@/src/data/types';

type Props = {
  suggestion: Suggestion;
  applying?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  // Long-press abre menú de snooze + opciones secundarias.
  onLongPress?: (suggestion: Suggestion) => void;
};

const ACTION_WIDTH = 96;

// Card de sugerencia para la Bandeja de Nova.
//   - Swipe izquierda → Rechazar (rojo, "✕ Rechazar")
//   - Swipe derecha   → Aprobar (verde, "✓ Aprobar")
//   - Long-press      → onLongPress (sheet con snooze 1h/3h/mañana/próx semana)
//   - Tap CTAs        → mismos botones que swipe (accesibilidad)
//
// Se monta sobre GeminiSurface para mantener la identidad visual de la app
// (mismo gradient violeta→azul→cyan que Mi Día / Tasks summary). El primer
// icono de la card va con el LinearGradient brand para acentuar la intención
// proactiva — patrón espejo de EmptyDayState first suggestion pill.
export function SuggestionCard({ suggestion, applying = false, onApprove, onReject, onLongPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const swipeableRef = useRef<Swipeable | null>(null);

  // Haptic medium cuando el swipe llega al threshold — la sensación "pop"
  // que avisa "voy a soltar y se va". Patrón Apple Mail / Things 3.
  const lastWillOpenRef = useRef<'left' | 'right' | null>(null);
  const handleSwipeProgress = useCallback((side: 'left' | 'right') => {
    if (Platform.OS === 'ios' && lastWillOpenRef.current !== side) {
      lastWillOpenRef.current = side;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleApprovePress = useCallback(() => {
    if (applying) return;
    if (Platform.OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    swipeableRef.current?.close();
    onApprove(suggestion.id);
  }, [applying, onApprove, suggestion.id]);

  const handleRejectPress = useCallback(() => {
    if (applying) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    swipeableRef.current?.close();
    onReject(suggestion.id);
  }, [applying, onReject, suggestion.id]);

  const handleLongPress = useCallback(() => {
    if (!onLongPress || applying) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onLongPress(suggestion);
  }, [applying, onLongPress, suggestion]);

  const renderRightActions = () => (
    <Pressable
      onPress={handleApprovePress}
      disabled={applying}
      style={({ pressed }) => [
        styles.swipeAction,
        styles.approveAction,
        { opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityLabel="Aprobar sugerencia"
      accessibilityRole="button"
    >
      <IconSymbol name="checkmark" size={20} color="#fff" />
      <Text style={styles.swipeLabel}>Aprobar</Text>
    </Pressable>
  );

  const renderLeftActions = () => (
    <Pressable
      onPress={handleRejectPress}
      disabled={applying}
      style={({ pressed }) => [
        styles.swipeAction,
        styles.rejectAction,
        { opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityLabel="Rechazar sugerencia"
      accessibilityRole="button"
    >
      <IconSymbol name="xmark" size={20} color="#fff" />
      <Text style={styles.swipeLabel}>Rechazar</Text>
    </Pressable>
  );

  // El icono va dentro de un LinearGradient brand cuando relevance ≥ 0.7
  // (sugerencia de alta prioridad). Sino va con tinte muted — mantiene
  // jerarquía visual sin que todas las cards griten igual de fuerte.
  const isHighPriority = (suggestion.relevance_score ?? 0) >= 0.7;

  return (
    <View style={styles.shadowWrap}>
      <Swipeable
        ref={swipeableRef}
        friction={2}
        leftThreshold={ACTION_WIDTH * 0.55}
        rightThreshold={ACTION_WIDTH * 0.55}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={(direction) => {
          if (direction === 'left') {
            // Swipe-from-left abre la acción izquierda (reject).
            handleRejectPress();
          } else {
            handleApprovePress();
          }
        }}
        onSwipeableOpen={() => {
          lastWillOpenRef.current = null;
        }}
        onBegan={() => {
          lastWillOpenRef.current = null;
        }}
        onSwipeableLeftWillOpen={() => handleSwipeProgress('left')}
        onSwipeableRightWillOpen={() => handleSwipeProgress('right')}
        containerStyle={styles.swipeContainer}
      >
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={400}
          android_ripple={null as any}
          style={({ pressed }) => [
            styles.pressable,
            { opacity: applying ? 0.55 : pressed ? 0.96 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${suggestion.preview_title}. ${suggestion.preview_body}`}
          accessibilityHint="Desliza a la derecha para aprobar, a la izquierda para rechazar. Mantén presionado para más opciones."
        >
          <GeminiSurface variant="card" radius={Radius.xl}>
            <View style={styles.inner}>
              <View style={styles.headerRow}>
                {isHighPriority ? (
                  <LinearGradient
                    colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconWrap}
                  >
                    <IconSymbol
                      name={mapIcon(suggestion.preview_icon)}
                      size={16}
                      color="#ffffff"
                    />
                  </LinearGradient>
                ) : (
                  <View style={[styles.iconWrap, { backgroundColor: c.primaryContainer }]}>
                    <IconSymbol
                      name={mapIcon(suggestion.preview_icon)}
                      size={16}
                      color={c.primary}
                    />
                  </View>
                )}
                <View style={styles.headerCol}>
                  <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                    {suggestion.preview_title}
                  </Text>
                  <Text style={[styles.body, { color: c.textMuted }]} numberOfLines={2}>
                    {suggestion.preview_body}
                  </Text>
                </View>
                {applying ? (
                  <ActivityIndicator size="small" color={c.primary} style={styles.spinner} />
                ) : null}
              </View>

              {suggestion.reason ? (
                <View style={[styles.reasonRow, { borderTopColor: c.border }]}>
                  <View style={[styles.reasonDot, { backgroundColor: '#8b5cf6' }]} />
                  <Text style={[styles.reasonText, { color: c.textSubtle }]} numberOfLines={3}>
                    {suggestion.reason}
                  </Text>
                </View>
              ) : null}

              <View style={styles.ctaRow}>
                <Pressable
                  onPress={handleRejectPress}
                  disabled={applying}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.ctaSecondary,
                    {
                      borderColor: c.border,
                      opacity: pressed ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    },
                  ]}
                  accessibilityLabel="Rechazar"
                  accessibilityRole="button"
                >
                  <Text style={[styles.ctaSecondaryText, { color: c.textMuted }]}>Rechazar</Text>
                </Pressable>
                <Pressable
                  onPress={handleApprovePress}
                  disabled={applying}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.ctaPrimary,
                    {
                      backgroundColor: c.primary,
                      opacity: pressed ? 0.86 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                  accessibilityLabel="Aprobar"
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaPrimaryText}>Aprobar</Text>
                </Pressable>
              </View>
            </View>
          </GeminiSurface>
        </Pressable>
      </Swipeable>
    </View>
  );
}

// Mapea el icono que llega del backend al SF Symbol más cercano.
// Los kinds del backend usan iconos genéricos tipo 'auto_awesome',
// 'exclamationmark.circle', 'tray.full'. Este map los traduce.
function mapIcon(value: string | null | undefined): any {
  if (!value) return 'sparkles';
  const v = String(value).toLowerCase();
  if (v.includes('exclamation')) return 'exclamationmark.circle';
  if (v.includes('tray')) return 'tray.full';
  if (v.includes('check')) return 'checkmark.circle';
  if (v.includes('calendar')) return 'calendar';
  if (v.includes('event')) return 'calendar';
  if (v === 'auto_awesome') return 'sparkles';
  if (v === 'school') return 'book';
  if (v === 'work') return 'briefcase';
  if (v === 'fitness_center') return 'figure.run';
  if (v === 'restaurant') return 'fork.knife';
  if (v === 'medical_services') return 'cross.case';
  if (v === 'flight') return 'airplane';
  if (v === 'self_improvement') return 'leaf';
  return 'sparkles';
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.sm,
  },
  swipeContainer: {
    overflow: 'hidden',
    borderRadius: Radius.xl,
  },
  pressable: {
    borderRadius: Radius.xl,
  },
  inner: {
    padding: Spacing.md + 2,
    gap: Spacing.sm + 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCol: {
    flex: 1,
    gap: 2,
  },
  spinner: {
    marginLeft: Spacing.sm,
  },
  title: {
    ...Typography.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    ...Typography.body,
    fontSize: 13.5,
    lineHeight: 18,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reasonDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
  },
  reasonText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  ctaSecondary: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ctaPrimary: {
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  ctaPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  swipeAction: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.xl,
  },
  approveAction: {
    backgroundColor: '#16a34a',
    marginLeft: Spacing.xs,
  },
  rejectAction: {
    backgroundColor: '#dc2626',
    marginRight: Spacing.xs,
  },
  swipeLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
