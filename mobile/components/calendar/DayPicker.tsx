import { useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday, todayISO } from '@/src/data/today';

type Props = {
  selectedDate: string;
  onSelect: (dateISO: string) => void;
  // Mapa fecha → cantidad de eventos. Permite mostrar el dot indicador
  // por día sin recalcular en cada chip.
  eventCounts: Record<string, number>;
  // Cuántos días mostrar empezando desde hoy. Default 14 = 2 semanas, suele
  // alcanzar para planificación a corto plazo sin saturar el scroll.
  days?: number;
};

// Etiqueta corta de día de la semana en español, sin punto final.
// Intl devuelve "lun." / "mar." en es-CO; le quitamos el punto para que
// quede consistente con el resto de la app.
function weekdayShort(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const raw = new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(dt);
  return raw.replace('.', '');
}

function dayNumber(dateISO: string): string {
  const [, , d] = dateISO.split('-').map((s) => parseInt(s, 10));
  return String(d);
}

export function DayPicker({ selectedDate, onSelect, eventCounts, days = 14 }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const scrollRef = useRef<ScrollView>(null);

  const dayList = useMemo(() => {
    const start = todayISO();
    return Array.from({ length: days }, (_, i) => addDaysISO(start, i));
  }, [days]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {dayList.map((dateISO) => {
        const isSelected = dateISO === selectedDate;
        const today = isToday(dateISO);
        const count = eventCounts[dateISO] ?? 0;

        const bg = isSelected ? c.primary : c.surface;
        const fg = isSelected ? c.onPrimary : c.text;
        const fgMuted = isSelected ? c.onPrimary : c.textMuted;
        const dotColor = isSelected ? c.onPrimary : c.primary;

        return (
          <Pressable
            key={dateISO}
            onPress={() => onSelect(dateISO)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: bg,
                borderColor: isSelected ? c.primary : c.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${weekdayShort(dateISO)} ${dayNumber(dateISO)}${count ? `, ${count} eventos` : ''}`}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.weekday, { color: fgMuted }]}>
              {weekdayShort(dateISO)}
            </Text>
            <Text style={[styles.day, { color: fg }]}>{dayNumber(dateISO)}</Text>
            <View style={styles.markerRow}>
              {today && !isSelected ? (
                <View style={[styles.todayPill, { backgroundColor: c.primary }]} />
              ) : null}
              {count > 0 ? (
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    width: 60,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  weekday: {
    ...Typography.micro,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  day: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  markerRow: {
    height: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  todayPill: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
