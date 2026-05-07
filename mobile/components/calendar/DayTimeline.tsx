import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SectionLabel } from '@/components/ui/SectionLabel';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isToday } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';

type Props = {
  dateISO: string;
  events: EventItem[]; // ya filtrados al día seleccionado
};

type TimeParts = {
  start: string;
  end: string | null;
  duration: string | null;
};

function minutesOf(value: string | null): number | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} h ${m} min`;
  if (h > 0) return `${h} h`;
  return `${m} min`;
}

function parseTime(time: string): TimeParts {
  if (!time) return { start: '', end: null, duration: null };
  const cleaned = time.replace(/[–—]/g, '-').replace(/\s/g, '');
  const match = cleaned.match(/^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?$/);
  if (!match) return { start: time, end: null, duration: null };

  const start = match[1];
  const end = match[2] ?? null;
  const startMinutes = minutesOf(start);
  const endMinutes = minutesOf(end);
  const duration =
    startMinutes !== null && endMinutes !== null && endMinutes > startMinutes
      ? durationLabel(endMinutes - startMinutes)
      : null;

  return { start, end, duration };
}

function startOf(event: EventItem): string | null {
  return parseTime(event.time).start || null;
}

function sortTimed(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    const am = minutesOf(startOf(a));
    const bm = minutesOf(startOf(b));
    if (am === null && bm === null) return a.title.localeCompare(b.title);
    if (am === null) return 1;
    if (bm === null) return -1;
    if (am === bm) return a.title.localeCompare(b.title);
    return am - bm;
  });
}

function timeIsFuture(event: EventItem, now: Date = new Date()): boolean {
  const minutes = minutesOf(startOf(event));
  if (minutes === null) return true;
  return minutes >= now.getHours() * 60 + now.getMinutes();
}

export function DayTimeline({ dateISO, events }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const { allDay, timed } = useMemo(() => {
    const all = [...events.filter((e) => !e.time)].sort((a, b) => a.title.localeCompare(b.title));
    const t = sortTimed(events.filter((e) => !!e.time));
    return { allDay: all, timed: t };
  }, [events]);

  const nowInsertIndex = useMemo(() => {
    if (!isToday(dateISO) || timed.length === 0) return null;
    const firstFuture = timed.findIndex((e) => timeIsFuture(e));
    return firstFuture === -1 ? timed.length : firstFuture;
  }, [dateISO, timed]);

  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      {allDay.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel label="Todo el día" count={allDay.length} />
          <View style={styles.cardStack}>
            {allDay.map((event) => (
              <AgendaEventCard key={event.id} event={event} allDay />
            ))}
          </View>
        </View>
      ) : null}

      {timed.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel label="Agenda del día" count={timed.length} />
          <View style={styles.cardStack}>
            {timed.map((event, idx) => (
              <View key={event.id}>
                {nowInsertIndex === idx ? <NowMarker color={c.primary} /> : null}
                <AgendaEventCard event={event} />
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

function AgendaEventCard({ event, allDay = false }: { event: EventItem; allDay?: boolean }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const time = parseTime(event.time);
  const meta = allDay
    ? 'Todo el día'
    : [time.end ? `Hasta ${time.end}` : null, time.duration].filter(Boolean).join(' · ');

  return (
    <View
      style={[
        styles.eventCard,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          shadowColor: scheme === 'light' ? '#0f172a' : '#000000',
        },
      ]}
    >
      <View style={[styles.eventAccent, { backgroundColor: event.featured ? c.primary : c.primaryContainer }]} />
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, { color: allDay ? c.primary : c.text }]}>
          {allDay ? 'Todo' : time.start}
        </Text>
        <Text style={[styles.timeSubtext, { color: c.textSubtle }]}>
          {allDay ? 'día' : time.end ?? ''}
        </Text>
      </View>
      <View style={styles.eventBody}>
        <Text style={[styles.eventTitle, { color: c.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        {meta ? (
          <Text style={[styles.eventMeta, { color: c.primary }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {event.description ? (
          <Text style={[styles.eventDescription, { color: c.textMuted }]} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
      </View>
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
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
  },
  cardStack: {
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  eventCard: {
    minHeight: 88,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  eventAccent: {
    width: 4,
  },
  timeColumn: {
    width: 72,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  timeText: {
    ...Typography.bodyStrong,
    fontSize: 16,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  timeSubtext: {
    ...Typography.caption,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  eventBody: {
    flex: 1,
    gap: 4,
    paddingVertical: Spacing.lg,
    paddingRight: Spacing.lg,
  },
  eventTitle: {
    ...Typography.title3,
    fontSize: 17,
    lineHeight: 23,
  },
  eventMeta: {
    ...Typography.caption,
    fontWeight: '700',
  },
  eventDescription: {
    ...Typography.caption,
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
