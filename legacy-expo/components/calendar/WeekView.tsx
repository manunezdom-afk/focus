import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;
const MONTH_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] as const;

type Props = {
  selectedDate: string; // ISO 'YYYY-MM-DD'
  events: EventItem[];
  onSelectDay: (dateISO: string) => void;
  onChangeWeek: (newDateISO: string) => void;
};

function startOfWeekMonday(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const offsetFromMonday = (dt.getDay() + 6) % 7;
  return addDaysISO(dateISO, -offsetFromMonday);
}

function dayNumOf(dateISO: string): number {
  return parseInt(dateISO.split('-')[2], 10);
}

function monthAbbrOf(dateISO: string): string {
  const m = parseInt(dateISO.split('-')[1], 10);
  return MONTH_ABBR[m - 1] ?? '';
}

function weekRangeLabel(mondayISO: string): string {
  const sundayISO = addDaysISO(mondayISO, 6);
  const mM = parseInt(mondayISO.split('-')[1], 10);
  const mD = parseInt(mondayISO.split('-')[2], 10);
  const sM = parseInt(sundayISO.split('-')[1], 10);
  const sD = parseInt(sundayISO.split('-')[2], 10);
  if (mM === sM) return `${mD}–${sD} ${MONTH_ABBR[mM - 1]}`;
  return `${mD} ${MONTH_ABBR[mM - 1]}–${sD} ${MONTH_ABBR[sM - 1]}`;
}

// Clave de orden temporal — eventos sin hora van al final.
function timeRank(t: string): number {
  const m = t?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function WeekView({ selectedDate, events, onSelectDay, onChangeWeek }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const monday = useMemo(() => startOfWeekMonday(selectedDate), [selectedDate]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i)),
    [monday],
  );
  const rangeLabel = useMemo(() => weekRangeLabel(monday), [monday]);

  // Agrupar eventos por fecha una sola vez.
  const eventsByDay = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    for (const e of events) {
      if (!e.date) continue;
      (map[e.date] ?? (map[e.date] = [])).push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => timeRank(a.time) - timeRank(b.time));
    }
    return map;
  }, [events]);

  function navigateWeek(dir: -1 | 1) {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    onChangeWeek(addDaysISO(monday, dir * 7));
  }

  return (
    <Animated.View style={styles.container}>
      {/* Header de la semana */}
      <View style={styles.navRow}>
        <Pressable
          onPress={() => navigateWeek(-1)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.navBtn,
            { opacity: pressed ? 0.65 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Semana anterior"
        >
          <IconSymbol name="chevron.left" size={15} color={c.textMuted} weight="semibold" />
        </Pressable>
        <Text style={[styles.rangeLabel, { color: c.text }]}>{rangeLabel}</Text>
        <Pressable
          onPress={() => navigateWeek(1)}
          hitSlop={10}
          style={({ pressed }) => [
            styles.navBtn,
            { opacity: pressed ? 0.65 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Semana siguiente"
        >
          <IconSymbol name="chevron.right" size={15} color={c.textMuted} weight="semibold" />
        </Pressable>
      </View>

      {/* Lista vertical de 7 días */}
      <View style={styles.list}>
        {days.map((dateISO, idx) => {
          const items = eventsByDay[dateISO] ?? [];
          const today = isToday(dateISO);
          const selected = dateISO === selectedDate;
          return (
            <Pressable
              key={dateISO}
              onPress={() => {
                if (Platform.OS === 'ios') void Haptics.selectionAsync();
                onSelectDay(dateISO);
              }}
              style={({ pressed }) => [
                styles.dayRow,
                {
                  backgroundColor: selected
                    ? c.primaryContainer
                    : pressed
                      ? c.surfaceMuted
                      : c.surface,
                  borderColor: c.border,
                  transform: [{ scale: pressed ? 0.992 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${DAY_LABELS[idx]} ${dayNumOf(dateISO)}`}
            >
              {/* Día — número grande + abreviatura */}
              <View style={styles.dayCol}>
                <Text
                  style={[
                    styles.dayNum,
                    { color: today ? c.primary : c.text, fontWeight: today ? '700' : '600' },
                  ]}
                >
                  {dayNumOf(dateISO)}
                </Text>
                <Text style={[styles.dayName, { color: c.textMuted }]}>
                  {DAY_LABELS[idx].slice(0, 3).toLowerCase()} · {monthAbbrOf(dateISO)}
                </Text>
              </View>

              {/* Eventos del día */}
              <View style={styles.eventsCol}>
                {items.length === 0 ? (
                  <Text style={[styles.emptyText, { color: c.textSubtle }]}>Sin eventos</Text>
                ) : (
                  items.slice(0, 3).map((e) => (
                    <View key={e.id} style={styles.eventRow}>
                      {e.time ? (
                        <Text style={[styles.eventTime, { color: c.primary }]}>{e.time}</Text>
                      ) : (
                        <Text style={[styles.eventTime, { color: c.textSubtle }]}>—</Text>
                      )}
                      <Text
                        style={[styles.eventTitle, { color: c.text }]}
                        numberOfLines={1}
                      >
                        {e.title}
                      </Text>
                    </View>
                  ))
                )}
                {items.length > 3 ? (
                  <Text style={[styles.moreText, { color: c.textMuted }]}>
                    +{items.length - 3} más
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeLabel: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  list: {
    gap: Spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  dayCol: {
    width: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  eventsCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '700',
    width: 56,
    fontVariant: ['tabular-nums'],
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
