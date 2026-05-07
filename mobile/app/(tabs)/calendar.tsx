import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateEventSheet } from '@/components/CreateEventSheet';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingState } from '@/components/LoadingState';
import { DayPicker } from '@/components/calendar/DayPicker';
import { DayTimeline } from '@/components/calendar/DayTimeline';
import { SmartDaySummary } from '@/components/calendar/SmartDaySummary';
import { NovaPromptCard } from '@/components/ui/NovaPromptCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { todayISO } from '@/src/data/today';
import { useEvents } from '@/src/data/useEvents';
import { useTasks } from '@/src/data/useTasks';

const MONTHS_ES = [
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
];

function currentMonthYear(): string {
  const d = new Date();
  const m = MONTHS_ES[d.getMonth()];
  return `${m[0].toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
}

// "Jueves 7 de mayo" para el eyebrow del día seleccionado. Construimos el
// Date a mediodía local — evita líos de DST en bordes de día.
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

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const events = useEvents('all');
  const tasks = useTasks();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [showSheet, setShowSheet] = useState(false);

  // Mapa fecha → cantidad de eventos. Se usa para mostrar los puntos en
  // los chips del DayPicker. Un único pase O(n) sobre el array completo.
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

  const pendingTasks = useMemo(
    () => tasks.tasks.filter((t) => !t.done).length,
    [tasks.tasks],
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

  const showLoading = events.loading && events.events.length === 0;
  const dayLabel = dayLabelLong(selectedDate);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader
        eyebrow={currentMonthYear()}
        title="Calendario"
        subtitle="Tu agenda con un toque de Nova."
      />

      {events.error ? (
        <View style={styles.bannerWrap}>
          <ErrorBanner
            message="No pudimos cargar tu calendario."
            onRetry={events.refresh}
          />
        </View>
      ) : null}

      {showLoading ? (
        <LoadingState />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={events.refreshing}
              onRefresh={events.refresh}
              tintColor={c.text}
            />
          }
        >
          <DayPicker
            selectedDate={selectedDate}
            onSelect={selectDay}
            eventCounts={eventCounts}
          />

          <View style={styles.dayHeader}>
            <Text style={[styles.dayEyebrow, { color: c.primary }]}>
              {dayLabel}
            </Text>
          </View>

          <View style={styles.summaryWrap}>
            <SmartDaySummary
              dateISO={selectedDate}
              events={eventsForSelectedDay}
              pendingTasksCount={pendingTasks}
              onAskNova={goToNova}
            />
          </View>

          {eventsForSelectedDay.length > 0 ? (
            <DayTimeline dateISO={selectedDate} events={eventsForSelectedDay} />
          ) : (
            <View style={styles.emptyWrap}>
              <NovaPromptCard
                title="Sin eventos para este día."
                description="Toca + para crear uno o pídele a Nova que lo agende."
              />
            </View>
          )}
        </ScrollView>
      )}

      <Pressable
        onPress={openCreate}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: c.primary,
            shadowColor: c.primary,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Crear evento"
      >
        <IconSymbol name="plus" size={24} color={c.onPrimary} />
      </Pressable>

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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  bannerWrap: { paddingHorizontal: Spacing.lg },

  scrollContent: {
    paddingBottom: 120, // espacio para el FAB
    gap: Spacing.lg,
  },

  dayHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  dayEyebrow: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  summaryWrap: {
    paddingHorizontal: Spacing.lg,
  },

  emptyWrap: {
    paddingHorizontal: Spacing.lg,
  },

  fab: {
    position: 'absolute',
    bottom: Spacing['2xl'] + 64,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
