import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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

// Pantalla Calendario — blueprint Stitch "Calendario Principal" traducido a RN.
// Estructura: header con título dinámico (Hoy / Mañana / fecha completa) +
// grilla semanal de 7 chips + timeline de eventos con estado past/now/upcoming.
// FAB flotante para crear evento. Empty state con CTA sutil hacia Nova.
//
// Datos: solo Supabase via useEvents('all'). No mocks, no demos.

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

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildHeadline(dateISO: string): { primary: string; secondary?: string } {
  const longLabel = capitalize(dayLabelLong(dateISO));
  if (isToday(dateISO)) {
    return { primary: 'Hoy', secondary: longLabel };
  }
  if (dateISO === addDaysISO(todayISO(), 1)) {
    return { primary: 'Mañana', secondary: longLabel };
  }
  return { primary: longLabel };
}

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const events = useEvents('all');
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [showSheet, setShowSheet] = useState(false);

  // Mapa fecha → cantidad de eventos. El DayPicker lo lee para mostrar el
  // dot debajo del número de día.
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

  const showLoading = events.loading && events.events.length === 0;
  const headline = buildHeadline(selectedDate);
  const hasEvents = eventsForSelectedDay.length > 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
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
            <View style={styles.header}>
              <Text style={[styles.headline, { color: c.text }]}>{headline.primary}</Text>
              {headline.secondary ? (
                <Text style={[styles.subheadline, { color: c.textMuted }]}>
                  {headline.secondary}
                </Text>
              ) : null}
            </View>

            {events.error ? (
              <View style={styles.bannerWrap}>
                <ErrorBanner
                  message="No pudimos cargar tus eventos."
                  onRetry={handleRefresh}
                />
              </View>
            ) : null}

            <DayPicker
              selectedDate={selectedDate}
              onSelect={selectDay}
              eventCounts={eventCounts}
            />

            {hasEvents ? (
              <DayTimeline dateISO={selectedDate} events={eventsForSelectedDay} />
            ) : (
              <View style={styles.emptyWrap}>
                <EmptyAgendaState
                  selectedDate={selectedDate}
                  onCreateEvent={openCreate}
                  onAskNova={goToNova}
                />
              </View>
            )}
          </ScrollView>

          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: pressed ? c.primaryPressed : c.primary,
                shadowColor: c.primary,
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
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceTint }]}>
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

  scrollContent: {
    paddingBottom: 140, // espacio extra para que la lista no quede tapada por el FAB
    gap: Spacing.lg,
  },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: 2,
  },
  headline: {
    ...Typography.display,
    fontSize: 32,
    lineHeight: 38,
  },
  subheadline: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
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
    bottom: 100, // libra el tab bar (~80px + breathing room)
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
