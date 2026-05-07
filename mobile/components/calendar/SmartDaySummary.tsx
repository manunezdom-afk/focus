import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isToday } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';

type Props = {
  dateISO: string;
  events: EventItem[];          // ya filtrados al día seleccionado
  pendingTasksCount: number;    // tareas reales relevantes para el día, calculadas por la pantalla
  onPlanWithNova: () => void;
};

function startOf(event: EventItem): string | null {
  if (!event.time) return null;
  const m = event.time.replace(/\s/g, '').match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : null;
}

function startMinutes(event: EventItem): number | null {
  const start = startOf(event);
  if (!start) return null;
  const [h, m] = start.split(':').map((part) => parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function sortedEvents(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    const am = startMinutes(a);
    const bm = startMinutes(b);
    if (am === null && bm === null) return a.title.localeCompare(b.title);
    if (am === null) return 1;
    if (bm === null) return -1;
    if (am === bm) return a.title.localeCompare(b.title);
    return am - bm;
  });
}

function nextEvent(dateISO: string, events: EventItem[]): EventItem | null {
  const ordered = sortedEvents(events);
  if (!isToday(dateISO)) return ordered[0] ?? null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = ordered.find((event) => {
    const minutes = startMinutes(event);
    return minutes !== null && minutes >= currentMinutes;
  });
  return upcoming ?? ordered[0] ?? null;
}

function buildSummary({
  dateISO,
  events,
  pendingTasksCount,
}: {
  dateISO: string;
  events: EventItem[];
  pendingTasksCount: number;
}): { headline: string; detail: string } {
  const total = events.length;

  if (total === 0 && pendingTasksCount === 0) {
    return {
      headline: 'Tienes el día libre.',
      detail: 'Puedes planificarlo con Nova.',
    };
  }

  if (total === 0) {
    return {
      headline: 'No tienes eventos.',
      detail: `Hay ${pendingTasksCount} ${pendingTasksCount === 1 ? 'tarea pendiente' : 'tareas pendientes'} para revisar.`,
    };
  }

  const eventsWord = total === 1 ? 'evento' : 'eventos';
  const tasksFragment =
    pendingTasksCount > 0
      ? ` También hay ${pendingTasksCount} ${pendingTasksCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}.`
      : '';
  const headline = `Tienes ${total} ${eventsWord}.`;
  const next = nextEvent(dateISO, events);
  if (!next) return { headline, detail: tasksFragment.trim() };

  const start = startOf(next);
  const detail = start
    ? `El próximo es "${next.title}" a las ${start}.${tasksFragment}`
    : `El primero es "${next.title}" para todo el día.${tasksFragment}`;

  return { headline, detail };
}

export function SmartDaySummary({ dateISO, events, pendingTasksCount, onPlanWithNova }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const summary = useMemo(
    () => buildSummary({ dateISO, events, pendingTasksCount }),
    [dateISO, events, pendingTasksCount],
  );
  const cardColor = scheme === 'light' ? c.primary : c.primaryContainer;
  const mutedText = scheme === 'light' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.72)';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardColor, borderColor: cardColor },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.24)' },
          ]}
        >
          <IconSymbol name="sparkles" size={18} color={c.onPrimary} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: mutedText }]}>
            Lectura Nova
          </Text>
          <Text style={[styles.headline, { color: c.onPrimary }]} numberOfLines={2}>
            {summary.headline}
          </Text>
          {summary.detail ? (
            <Text style={[styles.detail, { color: mutedText }]} numberOfLines={3}>
              {summary.detail}
            </Text>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={onPlanWithNova}
        style={({ pressed }) => [
          styles.cta,
          { borderTopColor: 'rgba(255,255,255,0.22)', opacity: pressed ? 0.75 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Planificar con Nova"
      >
        <Text style={[styles.ctaText, { color: c.onPrimary }]}>Planificar con Nova</Text>
        <IconSymbol name="chevron.right" size={16} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  eyebrow: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    ...Typography.title3,
    fontSize: 19,
    lineHeight: 24,
  },
  detail: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaText: {
    ...Typography.bodyStrong,
    fontSize: 13,
  },
});
