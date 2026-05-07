import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateEventSheet } from '@/components/CreateEventSheet';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { DayPicker } from '@/components/calendar/DayPicker';
import { DayTimeline } from '@/components/calendar/DayTimeline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday, todayISO } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';

// Pantalla Calendario — paridad con CalendarView legacy en estructura visual:
// header con mes (primary eyebrow) + "Calendario" como título principal,
// luego selector semanal de días + timeline de eventos del día. Mantiene lo
// bueno del calendario V1 (DayPicker compacto, FAB, CreateEventSheet) y
// adopta el header style legacy + hero halo + animaciones de Mi Día.
//
// Datos: 100% Supabase via useEvents('all'). No mocks, no demos.

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

function monthLabelOf(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  if (!y || !m) return '';
  const name = MONTH_NAMES_ES[m - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

function dayLabelLong(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return dateISO;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt);
}

function dayContextOf(dateISO: string): string {
  if (isToday(dateISO)) return 'Hoy';
  if (dateISO === addDaysISO(todayISO(), 1)) return 'Mañana';
  // Capitalizamos solo la primera letra del weekday.
  const label = dayLabelLong(dateISO);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const events = useEvents('all');
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [showSheet, setShowSheet] = useState(false);

  // Mapa fecha → cantidad de eventos para los dots del DayPicker.
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events.events) {
      if (e.date) counts[e.date] = (counts[e.date] ?? 0) + 1;
    }
    return counts;
  }, [events.events]);

  const eventsForSelectedDay = useMemo(
    () => events.events.filter((e) => e.date === selectedDate),
    [events.events, selectedDate],
  );

  const monthLabel = useMemo(() => monthLabelOf(selectedDate), [selectedDate]);
  const dayContext = useMemo(() => dayContextOf(selectedDate), [selectedDate]);

  function selectDay(dateISO: string) {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    setSelectedDate(dateISO);
  }

  function openCreate() {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowSheet(true);
  }

  function goToNova() {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    router.push('/(tabs)/nova');
  }

  function handleRefresh() {
    void events.refresh();
  }

  const handleDeleteEvent = useCallback(
    (id: string, title: string) => {
      Alert.alert('¿Eliminar evento?', title, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => void events.removeEvent(id),
        },
      ]);
    },
    [events],
  );

  const showLoading = events.loading && events.events.length === 0;
  const hasEvents = eventsForSelectedDay.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* ── Hero halo ─────────────────────────────────────────────────
          Mismo patrón que Mi Día: dos blobs tinted indigo apilados detrás
          del header. Crea profundidad ambiente sin requerir gradient lib. */}
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

      {showLoading ? (
        <LoadingState />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={events.refreshing}
                onRefresh={handleRefresh}
                tintColor={c.text}
              />
            }
          >
            {/* ── Header legacy-style: mes eyebrow + "Calendario" ──────── */}
            <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
              <Text style={[styles.titleLine, { color: c.text }]}>Calendario</Text>
              <Text style={styles.subLine} numberOfLines={1}>
                <Text style={[styles.subLineMonth, { color: c.primary }]}>{monthLabel}</Text>
                <Text style={{ color: c.textMuted }}>{`  ·  ${dayContext}`}</Text>
              </Text>
            </Animated.View>

            {events.error ? (
              <View style={styles.bannerWrap}>
                <ErrorBanner
                  message="No pudimos cargar tus eventos."
                  onRetry={handleRefresh}
                />
              </View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(60).duration(360)}>
              <DayPicker
                selectedDate={selectedDate}
                onSelect={selectDay}
                eventCounts={eventCounts}
              />
            </Animated.View>

            {hasEvents ? (
              <DayTimeline
                dateISO={selectedDate}
                events={eventsForSelectedDay}
                onDeleteEvent={handleDeleteEvent}
              />
            ) : (
              <Animated.View
                entering={FadeInDown.delay(140).duration(420)}
                style={styles.emptyWrap}
              >
                <EmptyAgendaState
                  selectedDate={selectedDate}
                  onCreateEvent={openCreate}
                  onAskNova={goToNova}
                />
              </Animated.View>
            )}
          </ScrollView>

          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: pressed ? c.primaryPressed : c.primary,
                shadowColor: c.primary,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Añadir evento"
          >
            <IconSymbol name="plus" size={26} color={c.onPrimary} />
          </Pressable>
        </>
      )}

      <CreateEventSheet
        visible={showSheet}
        onDismiss={() => setShowSheet(false)}
        defaultDate={selectedDate}
        onSubmit={async (input) => {
          const created = await events.addEvent(input);
          return !!created;
        }}
      />
    </SafeAreaView>
  );
}

function EmptyAgendaState({
  selectedDate,
  onCreateEvent,
  onAskNova,
}: {
  selectedDate: string;
  onCreateEvent: () => void;
  onAskNova: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const subject = isToday(selectedDate)
    ? 'hoy'
    : selectedDate === addDaysISO(todayISO(), 1)
      ? 'mañana'
      : 'este día';

  return (
    <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primaryContainer }]}>
        <IconSymbol name="calendar" size={24} color={c.primary} />
      </View>
      <View style={styles.emptyCopy}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>
          {`No tienes eventos para ${subject}.`}
        </Text>
        <Text style={[styles.emptyDescription, { color: c.textMuted }]}>
          Añade uno manualmente o pídele a Nova que te ayude a organizar el día.
        </Text>
      </View>
      <View style={styles.emptyActions}>
        <Pressable
          onPress={onCreateEvent}
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: pressed ? c.primaryPressed : c.primary },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Añadir evento"
        >
          <IconSymbol name="plus" size={17} color={c.onPrimary} />
          <Text style={[styles.primaryCtaText, { color: c.onPrimary }]}>Añadir evento</Text>
        </Pressable>
        <Pressable
          onPress={onAskNova}
          style={({ pressed }) => [
            styles.secondaryCta,
            {
              backgroundColor: pressed ? c.surfaceTint : c.surface,
              borderColor: c.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Planificar con Nova"
        >
          <IconSymbol name="sparkles" size={17} color={c.primary} />
          <Text style={[styles.secondaryCtaText, { color: c.primary }]}>
            Planificar con Nova
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Hero halo — mismos números que Mi Día para consistencia visual.
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

  scrollContent: {
    paddingBottom: 140,
    gap: Spacing.lg,
  },

  // Header legacy: título grande + subtítulo combinado mes/día. Espejo
  // de la jerarquía de Mi Día.
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 6,
  },
  titleLine: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  subLine: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },
  subLineMonth: {
    fontWeight: '700',
  },

  bannerWrap: {
    paddingHorizontal: Spacing.lg,
  },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
  },
  emptyCard: {
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.lg,
    alignItems: 'flex-start',
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    gap: Spacing.xs,
  },
  emptyTitle: {
    ...Typography.title3,
    fontSize: 18,
    lineHeight: 24,
  },
  emptyDescription: {
    ...Typography.body,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignSelf: 'stretch',
  },
  primaryCta: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  primaryCtaText: {
    ...Typography.bodyStrong,
    fontSize: 14,
  },
  secondaryCta: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  secondaryCtaText: {
    ...Typography.bodyStrong,
    fontSize: 14,
  },

  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
});
