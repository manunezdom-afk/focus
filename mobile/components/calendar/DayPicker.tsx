import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday } from '@/src/data/today';

type Props = {
  selectedDate: string;
  onSelect: (dateISO: string) => void;
  eventCounts: Record<string, number>;
};

const WEEKDAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'] as const;
const MONTH_ABBR = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'] as const;

function startOfWeekMonday(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const offsetFromMonday = (dt.getDay() + 6) % 7;
  return addDaysISO(dateISO, -offsetFromMonday);
}

function dayNum(dateISO: string): number {
  return parseInt(dateISO.split('-')[2], 10);
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

export function DayPicker({ selectedDate, onSelect, eventCounts }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const monday = useMemo(() => startOfWeekMonday(selectedDate), [selectedDate]);
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(monday, i)),
    [monday],
  );
  const rangeLabel = useMemo(() => weekRangeLabel(monday), [monday]);

  function navigateWeek(dir: -1 | 1) {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    onSelect(addDaysISO(monday, dir * 7));
  }

  return (
    <View style={styles.container}>
      {/* Week range nav */}
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

      {/* Days row */}
      <View style={styles.daysRow}>
        {week.map((dateISO, idx) => {
          const isSelected = dateISO === selectedDate;
          const today = isToday(dateISO);
          const count = eventCounts[dateISO] ?? 0;

          return (
            <Pressable
              key={dateISO}
              onPress={() => {
                if (Platform.OS === 'ios') void Haptics.selectionAsync();
                onSelect(dateISO);
              }}
              style={({ pressed }) => [
                styles.dayCol,
                {
                  opacity: pressed ? 0.78 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${WEEKDAY_LABELS[idx]} ${dayNum(dateISO)}`}
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isSelected ? c.primary : today ? c.primary : c.textMuted,
                    fontWeight: isSelected || today ? '700' : '500',
                  },
                ]}
              >
                {WEEKDAY_LABELS[idx]}
              </Text>
              <View
                style={[
                  styles.bubble,
                  isSelected
                    ? { backgroundColor: c.primary, shadowColor: c.primary, shadowOpacity: 0.22 }
                    : today
                      ? { borderWidth: 2, borderColor: c.primary }
                      : { backgroundColor: c.surfaceMuted },
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    { color: isSelected ? c.onPrimary : today ? c.primary : c.text },
                  ]}
                >
                  {dayNum(dateISO)}
                </Text>
              </View>
              {count > 0 && !isSelected ? (
                <View style={[styles.dot, { backgroundColor: c.primary }]} />
              ) : (
                <View style={styles.dotSpacer} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeLabel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.5,
  },
  bubble: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotSpacer: {
    width: 5,
    height: 5,
  },
});
