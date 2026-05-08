import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addDaysISO, isToday, todayISO } from '@/src/data/today';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const MONTH_NAMES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
] as const;

type Props = {
  // ISO 'YYYY-MM-DD' del día seleccionado. Define qué mes mostramos.
  selectedDate: string;
  // Mapa fecha→count para pintar puntos de actividad.
  eventCounts: Record<string, number>;
  // Tap en una celda: el padre cambia el día seleccionado y normalmente
  // también vuelve a la vista Día.
  onSelectDay: (dateISO: string) => void;
  // Navegación de mes anterior/siguiente; cambia el día seleccionado al
  // día 1 del mes destino.
  onChangeMonth: (newDateISO: string) => void;
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Devuelve la fecha del primer lunes mostrado en la grilla del mes (puede
// ser del mes anterior si el día 1 cae martes-domingo).
function firstGridMonday(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  const firstOfMonth = new Date(y, m - 1, 1, 12, 0, 0);
  // Lunes = 0 en nuestro sistema. (getDay() devuelve 0=Dom)
  const offsetFromMonday = (firstOfMonth.getDay() + 6) % 7;
  const d = new Date(firstOfMonth);
  d.setDate(firstOfMonth.getDate() - offsetFromMonday);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthLabel(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  if (!y || !m) return '';
  const name = MONTH_NAMES[m - 1] ?? '';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

function isInMonth(dateISO: string, refMonthISO: string): boolean {
  return dateISO.slice(0, 7) === refMonthISO.slice(0, 7);
}

function firstOfNextMonth(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  const next = new Date(y, m, 1, 12, 0, 0); // m=current+1 porque m-1 es el actual
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;
}

function firstOfPrevMonth(dateISO: string): string {
  const [y, m] = dateISO.split('-').map((s) => parseInt(s, 10));
  const prev = new Date(y, m - 2, 1, 12, 0, 0);
  return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-01`;
}

export function MonthView({ selectedDate, eventCounts, onSelectDay, onChangeMonth }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const gridStart = useMemo(() => firstGridMonday(selectedDate), [selectedDate]);
  // 6 filas × 7 columnas = 42 celdas (cubre todos los layouts de mes).
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i)),
    [gridStart],
  );
  const label = useMemo(() => monthLabel(selectedDate), [selectedDate]);

  function handlePrev() {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    onChangeMonth(firstOfPrevMonth(selectedDate));
  }
  function handleNext() {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    onChangeMonth(firstOfNextMonth(selectedDate));
  }

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.container}>
      {/* Header del mes con chevrons */}
      <View style={styles.navRow}>
        <Pressable
          onPress={handlePrev}
          hitSlop={10}
          style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
        >
          <IconSymbol name="chevron.left" size={15} color={c.textMuted} weight="semibold" />
        </Pressable>
        <Text style={[styles.monthLabel, { color: c.text }]}>{label}</Text>
        <Pressable
          onPress={handleNext}
          hitSlop={10}
          style={({ pressed }) => [styles.navBtn, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
        >
          <IconSymbol name="chevron.right" size={15} color={c.textMuted} weight="semibold" />
        </Pressable>
      </View>

      {/* Cabecera de días de la semana */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={`${w}-${i}`}
            style={[styles.weekdayText, { color: c.textSubtle }]}
          >
            {w}
          </Text>
        ))}
      </View>

      {/* Grilla 6×7 */}
      <View style={styles.grid}>
        {cells.map((dateISO) => {
          const dayNum = parseInt(dateISO.split('-')[2], 10);
          const inMonth = isInMonth(dateISO, selectedDate);
          const selected = dateISO === selectedDate;
          const today = isToday(dateISO);
          const count = eventCounts[dateISO] ?? 0;

          return (
            <Pressable
              key={dateISO}
              onPress={() => {
                if (Platform.OS === 'ios') void Haptics.selectionAsync();
                onSelectDay(dateISO);
              }}
              style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.65 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={`Día ${dayNum}`}
              accessibilityState={{ selected }}
            >
              <View
                style={[
                  styles.cellInner,
                  selected
                    ? { backgroundColor: c.primary }
                    : today
                      ? { borderWidth: 1.5, borderColor: c.primary }
                      : null,
                ]}
              >
                <Text
                  style={[
                    styles.cellNum,
                    {
                      color: selected
                        ? c.onPrimary
                        : today
                          ? c.primary
                          : inMonth
                            ? c.text
                            : c.textSubtle,
                      fontWeight: selected || today ? '700' : '500',
                    },
                  ]}
                >
                  {dayNum}
                </Text>
              </View>
              {count > 0 ? (
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: selected ? c.onPrimary : c.primary },
                  ]}
                />
              ) : (
                <View style={styles.dotSpacer} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

// Helper exportable para que el padre construya el día por defecto al
// cambiar de mes (queremos quedarnos en día 1 del mes destino).
export function firstOfMonthFor(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

// Re-exportamos también todayISO para conveniencia de quien use esta vista.
export { todayISO };

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
  monthLabel: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.1,
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingBottom: 2,
  },
  weekdayText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  cellInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellNum: {
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dotSpacer: {
    width: 4,
    height: 4,
  },
});
