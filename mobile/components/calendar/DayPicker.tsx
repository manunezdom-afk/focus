import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday } from '@/src/data/today';

type Props = {
  selectedDate: string;
  onSelect: (dateISO: string) => void;
  // Mapa fecha → cantidad de eventos. Permite mostrar un dot debajo del
  // número del día cuando hay eventos.
  eventCounts: Record<string, number>;
};

// Convención ES-CO de Stitch: L M X J V S D (X para miércoles, evita la
// ambigüedad de "M" duplicada). Lunes = primer día de la semana.
const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

function startOfWeekMonday(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  // getDay(): 0 = domingo .. 6 = sábado. Trasladamos para que lunes = 0.
  const offsetFromMonday = (dt.getDay() + 6) % 7;
  return addDaysISO(dateISO, -offsetFromMonday);
}

function dayNumber(dateISO: string): string {
  const [, , d] = dateISO.split('-').map((s) => parseInt(s, 10));
  return String(d);
}

export function DayPicker({ selectedDate, onSelect, eventCounts }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const week = useMemo(() => {
    const start = startOfWeekMonday(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  }, [selectedDate]);

  return (
    <View style={styles.row}>
      {week.map((dateISO, idx) => {
        const isSelected = dateISO === selectedDate;
        const today = isToday(dateISO);
        const count = eventCounts[dateISO] ?? 0;
        const letter = WEEKDAY_LETTERS[idx];

        const letterColor = isSelected
          ? c.primary
          : today
            ? c.primary
            : c.textMuted;
        const letterWeight = isSelected || today ? '700' : '500';

        return (
          <Pressable
            key={dateISO}
            onPress={() => onSelect(dateISO)}
            style={({ pressed }) => [
              styles.column,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              `${letter} ${dayNumber(dateISO)}${count ? `, ${count} ${count === 1 ? 'evento' : 'eventos'}` : ''}`
            }
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.weekdayLetter,
                { color: letterColor, fontWeight: letterWeight },
              ]}
            >
              {letter}
            </Text>
            <View
              style={[
                styles.dayBubble,
                isSelected
                  ? {
                      backgroundColor: c.primary,
                      shadowColor: c.primary,
                    }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  { color: isSelected ? c.onPrimary : c.text },
                ]}
              >
                {dayNumber(dateISO)}
              </Text>
            </View>
            <View style={styles.markerRow}>
              {count > 0 && !isSelected ? (
                <View style={[styles.dot, { backgroundColor: c.primary }]} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.sm,
  },
  weekdayLetter: {
    ...Typography.micro,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayBubble: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 2,
  },
  dayNumber: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  markerRow: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
  },
});
