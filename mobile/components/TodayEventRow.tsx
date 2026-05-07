import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem } from '@/src/data/types';

type Props = {
  event: EventItem;
  // Última fila no dibuja la línea vertical hacia abajo (cierra el timeline).
  isLast?: boolean;
};

// Determina si el evento ya pasó, está en curso, o es futuro.
// Compara con la hora local actual usando "HH:MM" o "HH:MM-HH:MM".
type Status = 'past' | 'now' | 'future' | 'unknown';

function getStatus(time: string, now: Date): Status {
  if (!time) return 'unknown';
  const m = time.replace(/\s/g, '').match(/^(\d{1,2}):(\d{2})(?:-(\d{1,2}):(\d{2}))?$/);
  if (!m) return 'unknown';
  const startMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const endMin = m[3] ? parseInt(m[3], 10) * 60 + parseInt(m[4], 10) : startMin + 30;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin >= endMin) return 'past';
  if (nowMin >= startMin) return 'now';
  return 'future';
}

function formatTime(time: string): string {
  if (!time) return '';
  const m = time.replace(/\s/g, '').match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : time;
}

// Timeline-style event row para Mi Día. Réplica de la fila del legacy
// DayTimeGrid: hora a la izquierda, dot grande, línea vertical conectando
// con el siguiente evento, título a la derecha + chip de estado.
//
// Estados de pill (decididos en runtime comparando vs hora local):
//   past   → "HECHO ✓" en surfaceTint
//   now    → "EN CURSO" en primary filled
//   future → sin pill
export function TodayEventRow({ event, isLast = false }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const status = getStatus(event.time, new Date());
  const time = formatTime(event.time);

  // Color del dot: futuro/now=primary, past=muted
  const dotColor = status === 'past' ? c.borderStrong : c.primary;
  const lineColor = status === 'past' ? c.border : c.borderStrong;
  const titleColor = status === 'past' ? c.textMuted : c.text;

  // Pill: HECHO ✓ (past), EN CURSO (now), nada (future)
  let pill: { label: string; bg: string; fg: string } | null = null;
  if (status === 'past') {
    pill = { label: 'HECHO ✓', bg: c.surfaceTint, fg: c.primary };
  } else if (status === 'now') {
    pill = { label: 'EN CURSO', bg: c.primary, fg: c.onPrimary };
  }

  return (
    <View style={styles.row}>
      {/* Columna izquierda: hora */}
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: time ? c.text : c.textSubtle }]}>
          {time || '—'}
        </Text>
      </View>

      {/* Línea vertical + dot — el "rail" del timeline */}
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast ? (
          <View style={[styles.line, { backgroundColor: lineColor }]} />
        ) : null}
      </View>

      {/* Título + descripción + pill */}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={2}>
            {event.title}
          </Text>
          {pill ? (
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
            </View>
          ) : null}
        </View>
        {event.description ? (
          <Text style={[styles.desc, { color: c.textMuted }]} numberOfLines={1}>
            {event.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    minHeight: 64,
  },
  timeCol: {
    width: 56,
    paddingTop: 2,
  },
  time: {
    ...Typography.bodyStrong,
    fontVariant: ['tabular-nums'],
    fontSize: 14,
  },
  rail: {
    width: 16,
    alignItems: 'center',
    paddingTop: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 2,
  },
  body: {
    flex: 1,
    paddingLeft: Spacing.sm,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.title3,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  desc: { ...Typography.caption },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
