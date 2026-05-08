import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem, Task } from '@/src/data/types';

const DAY_ABBR = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

type Props = {
  tasks: Task[];
  events?: EventItem[];
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function startOfWeekMonday(): Date {
  const today = new Date();
  const dow = today.getDay(); // 0=Dom
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Card de resumen semanal calculado sobre datos reales:
//   - completions per day (last 7 days starting Monday)
//   - totalDone, activeDays, pct, eventsThisWeek
//   - 7-day bar chart
// No inventa nada: si no hay tareas hechas, todas las barras quedan a 0.
export function WeeklyStatsCard({ tasks, events = [] }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const stats = useMemo(() => {
    const monday = startOfWeekMonday();
    const today = new Date();

    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    // Conteo de tareas done por día usando doneAt (epoch ms).
    const countsByDay = weekDates.map(
      (d) =>
        tasks.filter(
          (t) => t.done && t.doneAt && isSameDay(new Date(t.doneAt), d),
        ).length,
    );

    const totalDone = countsByDay.reduce((a, b) => a + b, 0);
    const activeDays = countsByDay.filter((cnt) => cnt > 0).length;

    // Total de tareas "tracker" — solo las que están en buckets activos
    // (hoy/semana). Algún día se excluye para no penalizar el %.
    const totalTracked = tasks.filter(
      (t) => t.category === 'hoy' || t.category === 'semana',
    ).length;
    const pct = totalTracked > 0 ? Math.round((totalDone / totalTracked) * 100) : 0;

    // Eventos en la semana (por date ISO).
    const weekIsoSet = new Set(weekDates.map(isoOf));
    const eventsThisWeek = events.filter((ev) => ev.date && weekIsoSet.has(ev.date)).length;

    const maxCount = Math.max(...countsByDay, 1);

    return {
      countsByDay,
      totalDone,
      activeDays,
      pct,
      eventsThisWeek,
      maxCount,
      weekDates,
      today,
    };
  }, [tasks, events]);

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceTint, borderColor: c.border }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <IconSymbol name="calendar" size={16} color={c.primary} />
        <Text style={[styles.headerText, { color: c.text }]}>Semana en resumen</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat color={c.primary} value={stats.totalDone} label="Hechas" surface={c.surface} />
        <Stat color={c.primary} value={`${stats.pct}%`} label="Progreso" surface={c.surface} />
        <Stat color={c.primary} value={stats.activeDays} label="Días" surface={c.surface} />
        {events.length > 0 ? (
          <Stat color={c.primary} value={stats.eventsThisWeek} label="Eventos" surface={c.surface} />
        ) : null}
      </View>

      {/* 7-day bar chart */}
      <View style={styles.chartRow}>
        {stats.weekDates.map((d, i) => {
          const count = stats.countsByDay[i];
          const isCurrent = isSameDay(d, stats.today);
          const isFuture = d > stats.today && !isCurrent;
          const barH = isFuture
            ? 4
            : Math.max(4, Math.round((count / stats.maxCount) * 36));
          const barColor = isFuture
            ? c.surfaceMuted
            : isCurrent
              ? c.primary
              : count > 0
                ? c.primaryContainer
                : c.surfaceMuted;
          return (
            <View key={i} style={styles.chartCol}>
              <View
                style={[
                  styles.bar,
                  { height: barH, backgroundColor: barColor },
                ]}
              />
              <Text
                style={[
                  styles.dayLabel,
                  { color: isCurrent ? c.primary : c.textSubtle, fontWeight: isCurrent ? '700' : '500' },
                ]}
              >
                {DAY_ABBR[i]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  color,
  surface,
}: {
  value: string | number;
  label: string;
  color: string;
  surface: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.statCell, { backgroundColor: surface }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 4,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 999,
  },
  dayLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
