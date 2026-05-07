import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { EventRow } from '@/components/EventRow';
import { LoadingState } from '@/components/LoadingState';
import { SectionHeader } from '@/components/SectionHeader';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { dateLabelShort, isToday, todayISO } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';
import { useEvents } from '@/src/data/useEvents';

type Section =
  | { type: 'header'; title: string; count: number }
  | { type: 'event'; event: EventItem };

// Agrupa los eventos por `date`. Eventos con date null caen en bucket 'sin-fecha'
// y van al final. Los del pasado se ocultan por defecto en Fase 2 — Calendario
// solo muestra hoy + futuro para mantener la lista útil. Cuando haya filtros
// (Fase 3) podemos exponer "Mostrar pasados".
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

  // Orden: por clave ASC. 'sin-fecha' al final (forzamos prefijo '~' al sortear).
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
  const { events, loading, refreshing, error, refresh } = useEvents('all');

  const sections = useMemo(() => groupAndFlatten(events), [events]);
  const showLoading = loading && events.length === 0;
  const showEmpty = !loading && sections.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Calendario</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Eventos de hoy en adelante.
        </Text>
      </View>

      {error ? <ErrorBanner message="No pudimos cargar tu calendario." onRetry={refresh} /> : null}

      {showLoading ? (
        <LoadingState />
      ) : showEmpty ? (
        <EmptyState
          title="Sin eventos próximos"
          description="Crea eventos desde la app web o desde Nova; aparecerán aquí."
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, idx) =>
            item.type === 'header' ? `h-${item.title}-${idx}` : item.event.id
          }
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <SectionHeader title={item.title} count={item.count} />
            ) : (
              <EventRow event={item.event} />
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.text} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 4 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, lineHeight: 21 },
  listContent: { paddingBottom: 32 },
});
