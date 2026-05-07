import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EventRow } from '@/components/EventRow';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isToday } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';

type Props = {
  dateISO: string;
  events: EventItem[]; // ya filtrados al día seleccionado
};

// Compara HH:MM contra la hora actual local. Devuelve true si la hora pasada
// es >= ahora. Útil para insertar el separador "Ahora" en el día actual.
function timeIsFuture(timeHHMM: string, now: Date = new Date()): boolean {
  const m = timeHHMM.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return true;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const eventMinutes = h * 60 + mm;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return eventMinutes >= nowMinutes;
}

function startOf(event: EventItem): string {
  const m = event.time?.replace(/\s/g, '').match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : '';
}

// Ordena por hora de inicio asc. Eventos con misma hora se ordenan por título
// para que el orden sea estable entre renders.
function sortTimed(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    const sa = startOf(a);
    const sb = startOf(b);
    if (sa === sb) return a.title.localeCompare(b.title);
    return sa.localeCompare(sb);
  });
}

export function DayTimeline({ dateISO, events }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const { allDay, timed } = useMemo(() => {
    const all = events.filter((e) => !e.time);
    const t = sortTimed(events.filter((e) => !!e.time));
    return { allDay: all, timed: t };
  }, [events]);

  // Índice de inserción del separador "Ahora" — sólo si miramos hoy y hay
  // eventos con hora. Es el primer evento cuyo start >= hora actual.
  const nowInsertIndex = useMemo(() => {
    if (!isToday(dateISO) || timed.length === 0) return null;
    const firstFuture = timed.findIndex((e) => timeIsFuture(startOf(e)));
    // Si todos pasaron, lo ponemos al final (índice = length).
    return firstFuture === -1 ? timed.length : firstFuture;
  }, [dateISO, timed]);

  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      {allDay.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel label="Todo el día" count={allDay.length} />
          <View style={[styles.rows, { backgroundColor: c.surface, borderColor: c.border }]}>
            {allDay.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </View>
        </View>
      ) : null}

      {timed.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel label="Agenda" count={timed.length} />
          <View style={[styles.rows, { backgroundColor: c.surface, borderColor: c.border }]}>
            {timed.map((event, idx) => (
              <View key={event.id}>
                {nowInsertIndex === idx ? <NowMarker color={c.primary} /> : null}
                <EventRow event={event} />
                {nowInsertIndex === timed.length && idx === timed.length - 1 ? (
                  <NowMarker color={c.primary} trailing />
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function NowMarker({ color, trailing = false }: { color: string; trailing?: boolean }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View
      style={[
        nowStyles.row,
        { backgroundColor: c.surface, borderBottomColor: c.border },
        trailing ? nowStyles.trailing : null,
      ]}
    >
      <View style={[nowStyles.dot, { backgroundColor: color }]} />
      <View style={[nowStyles.line, { backgroundColor: color }]} />
      <Text style={[nowStyles.label, { color }]}>Ahora</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  section: {
    gap: 0,
  },
  rows: {
    marginHorizontal: Spacing.lg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});

const nowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trailing: {
    borderBottomWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  label: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
