import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateEventSheet } from '@/components/CreateEventSheet';
import { ErrorBanner } from '@/components/ErrorBanner';
import { EventRow } from '@/components/EventRow';
import { LoadingState } from '@/components/LoadingState';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { NovaPromptCard } from '@/components/ui/NovaPromptCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { dateLabelShort, isToday, todayISO } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';
import { useEvents } from '@/src/data/useEvents';

// Mes en español para el eyebrow del header (ej: "Mayo 2026"). Mismo
// patrón que el legacy CalendarView.
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
  return `${MONTHS_ES[d.getMonth()][0].toUpperCase()}${MONTHS_ES[d.getMonth()].slice(1)} ${d.getFullYear()}`;
}

type Section =
  | { type: 'header'; title: string; count: number }
  | { type: 'event'; event: EventItem };

// Agrupa los eventos por `date`. Eventos con date null caen en bucket
// 'sin-fecha' y van al final. Los del pasado se ocultan por defecto en
// Fase 2 — Calendario solo muestra hoy + futuro para mantener la lista útil.
function groupAndFlatten(events: EventItem[]): Section[] {
  const today = todayISO();
  const futureOrToday = events.filter((e) => !e.date || e.date >= today);

  const buckets = new Map<string, EventItem[]>();
  for (const e of futureOrToday) {
    const key = e.date ?? 'sin-fecha';
    const arr = buckets.get(key) ?? [];
    arr.push(e);
    buckets.set(key, arr);
  }

  // Orden: por clave ASC. 'sin-fecha' al final (forzamos prefijo '~').
  const sorted = Array.from(buckets.entries()).sort((a, b) => {
    const keyA = a[0] === 'sin-fecha' ? '~' : a[0];
    const keyB = b[0] === 'sin-fecha' ? '~' : b[0];
    return keyA.localeCompare(keyB);
  });

  const out: Section[] = [];
  for (const [key, items] of sorted) {
    const title =
      key === 'sin-fecha'
        ? 'Sin fecha'
        : isToday(key)
          ? `Hoy · ${dateLabelShort(key)}`
          : dateLabelShort(key);
    out.push({ type: 'header', title, count: items.length });
    for (const e of items) out.push({ type: 'event', event: e });
  }
  return out;
}

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const events = useEvents('all');
  const [showSheet, setShowSheet] = useState(false);

  const sections = useMemo(() => groupAndFlatten(events.events), [events.events]);
  const showLoading = events.loading && events.events.length === 0;
  const showEmpty = !events.loading && sections.length === 0;

  function openCreate() {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowSheet(true);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader
        eyebrow={currentMonthYear()}
        title="Calendario"
        subtitle="Eventos de hoy en adelante."
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
      ) : showEmpty ? (
        <View style={styles.emptyWrap}>
          <NovaPromptCard
            title="Sin eventos próximos."
            description="Crea uno con el botón + o pídeselo a Nova."
          />
          <View style={styles.emptyCtaRow}>
            <PrimaryButton
              label="Nuevo evento"
              size="md"
              onPress={openCreate}
              leftIcon={<IconSymbol name="plus" size={16} color={c.onPrimary} />}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, idx) =>
            item.type === 'header' ? `h-${item.title}-${idx}` : item.event.id
          }
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <SectionLabel label={item.title} count={item.count} />
            ) : (
              <EventRow event={item.event} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={events.refreshing}
              onRefresh={events.refresh}
              tintColor={c.text}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* FAB siempre visible (excepto en empty state que ya tiene su CTA). */}
      {!showEmpty ? (
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
      ) : null}

      <CreateEventSheet
        visible={showSheet}
        onDismiss={() => setShowSheet(false)}
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
  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  emptyCtaRow: {
    alignSelf: 'flex-start',
  },
  listContent: { paddingBottom: 100 }, // espacio para el FAB

  fab: {
    position: 'absolute',
    bottom: Spacing['2xl'] + 64, // sobre la tab bar
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Sombra para destacar sobre el contenido
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
