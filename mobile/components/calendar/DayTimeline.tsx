import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { detectEventKind, getBlockColors } from '@/src/data/blockColors';
import { isToday } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';

type Props = {
  dateISO: string;
  events: EventItem[]; // ya filtrados al día seleccionado
  // Llamado al tocar el ícono papelera; el padre maneja la confirmación
  // (Alert.alert con destructive). Si no se pasa, no se muestra el botón.
  onDeleteEvent?: (id: string, title: string) => void;
};

// Estado temporal de un evento dentro del día. `now` solo aplica cuando
// el día seleccionado es hoy y el reloj está dentro del rango del evento.
type Window = 'past' | 'now' | 'upcoming' | 'untimed';

function minutesOf(value: string | null): number | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function parseTimeRange(time: string): { start: string | null; end: string | null } {
  if (!time) return { start: null, end: null };
  const cleaned = time.replace(/[–—]/g, '-').replace(/\s/g, '');
  const match = cleaned.match(/^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?$/);
  if (!match) return { start: null, end: null };
  return { start: match[1], end: match[2] ?? null };
}

// Si no hay end time asumimos 60 min de duración para decidir si está
// "ahora" / "pasado". Suficiente para destacar el evento vigente sin
// inventar UI de "in progress".
const DEFAULT_DURATION_MIN = 60;

function classify(event: EventItem, isCurrentDay: boolean, nowMinutes: number): Window {
  const { start, end } = parseTimeRange(event.time);
  if (!start) return 'untimed';
  if (!isCurrentDay) return 'upcoming';

  const startMin = minutesOf(start);
  if (startMin === null) return 'untimed';
  const endMin = minutesOf(end) ?? startMin + DEFAULT_DURATION_MIN;

  if (nowMinutes >= startMin && nowMinutes < endMin) return 'now';
  if (nowMinutes >= endMin) return 'past';
  return 'upcoming';
}

function sortByTime(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    const am = minutesOf(parseTimeRange(a.time).start);
    const bm = minutesOf(parseTimeRange(b.time).start);
    // Untimed (todo el día) primero
    if (am === null && bm === null) return a.title.localeCompare(b.title);
    if (am === null) return -1;
    if (bm === null) return 1;
    if (am === bm) return a.title.localeCompare(b.title);
    return am - bm;
  });
}

export function DayTimeline({ dateISO, events, onDeleteEvent }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isCurrentDay = isToday(dateISO);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const sorted = useMemo(() => sortByTime(events), [events]);

  if (sorted.length === 0) return null;

  return (
    <View style={styles.list}>
      {sorted.map((event, idx) => {
        const window = classify(event, isCurrentDay, nowMinutes);
        return (
          <TimelineRow
            key={event.id}
            event={event}
            window={window}
            c={c}
            scheme={scheme}
            enterIndex={idx}
            onDeletePress={
              onDeleteEvent ? () => onDeleteEvent(event.id, event.title) : undefined
            }
          />
        );
      })}
    </View>
  );
}

function TimelineRow({
  event,
  window,
  c,
  scheme,
  enterIndex,
  onDeletePress,
}: {
  event: EventItem;
  window: Window;
  c: typeof Colors.light;
  scheme: 'light' | 'dark';
  enterIndex: number;
  onDeletePress?: () => void;
}) {
  const { start } = parseTimeRange(event.time);
  const isPast = window === 'past';
  const isNow = window === 'now';
  const isUntimed = window === 'untimed';
  const timeLabel = isUntimed ? 'Todo' : start ?? '';
  const enterDelay = Math.min(60 + enterIndex * 24, 160);

  // Color por tipo de bloque — evento azul, recordatorio ámbar, focus cyan.
  const kind = detectEventKind({ title: event.title, section: event.section });
  const kindColors = getBlockColors(kind, scheme);

  const cardBg = isNow ? c.primaryContainer : c.surface;
  const cardBorder = isNow ? c.primary : c.border;
  const cardBorderWidth = isNow ? 2 : StyleSheet.hairlineWidth;
  const timeColor = isNow
    ? c.primary
    : isPast
      ? c.textSubtle
      : isUntimed
        ? kindColors.accent
        : c.text;

  return (
    <Animated.View
      entering={FadeInDown.delay(enterDelay).duration(190)}
      style={[styles.row, isPast ? styles.rowPast : null]}
    >
      <View style={styles.timeCol}>
        <Text
          style={[
            styles.timeText,
            { color: timeColor, fontWeight: isNow ? '700' : '600' },
          ]}
        >
          {timeLabel}
        </Text>
      </View>
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            borderWidth: cardBorderWidth,
            borderLeftColor: kindColors.accent,
            borderLeftWidth: 3,
            shadowColor: isNow ? c.primary : '#000000',
            shadowOpacity: isNow ? 0.18 : 0.04,
            shadowRadius: isNow ? 18 : 8,
            shadowOffset: { width: 0, height: isNow ? 8 : 4 },
            elevation: isNow ? 4 : 1,
          },
        ]}
      >
        {/* Chip de categoría arriba del título */}
        <View style={styles.kindRow}>
          <View style={[styles.kindChip, { backgroundColor: kindColors.badge }]}>
            <Text style={[styles.kindChipText, { color: kindColors.badgeText }]}>
              {kindColors.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardHead}>
          <Text
            style={[
              styles.title,
              {
                color: c.text,
                textDecorationLine: isPast ? 'line-through' : 'none',
                opacity: isPast ? 0.7 : 1,
              },
            ]}
            numberOfLines={2}
          >
            {event.title}
          </Text>

          {/* Pills: "Ahora" si en curso, "Finalizado" si pasado.
              Parity con el legacy CalendarView que mostraba ambos. */}
          {isNow ? (
            <View style={[styles.nowBadge, { backgroundColor: c.surface }]}>
              <Text style={[styles.nowBadgeText, { color: c.primary }]}>Ahora</Text>
            </View>
          ) : isPast ? (
            <View style={[styles.pastBadge, { backgroundColor: c.surfaceMuted }]}>
              <Text style={[styles.pastBadgeText, { color: c.textMuted }]}>Finalizado</Text>
            </View>
          ) : null}

          {/* Botón papelera — paridad con Mi Día. El padre maneja la
              confirmación con Alert.alert destructive. */}
          {onDeletePress ? (
            <Pressable
              onPress={onDeletePress}
              hitSlop={8}
              style={({ pressed }) => [
                styles.deleteBtn,
                {
                  backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                  opacity: pressed ? 0.65 : 1,
                  transform: [{ scale: pressed ? 0.92 : 1 }],
                },
              ]}
              accessibilityLabel="Eliminar evento"
              accessibilityRole="button"
            >
              <IconSymbol name="trash.fill" size={14} color={c.textSubtle} />
            </Pressable>
          ) : null}
        </View>
        {event.description ? (
          <Text
            style={[
              styles.description,
              {
                color: isPast ? c.textSubtle : isNow ? c.primary : c.textMuted,
                opacity: isPast ? 0.8 : 1,
              },
            ]}
            numberOfLines={2}
          >
            {event.description}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowPast: {
    opacity: 0.7,
  },
  timeCol: {
    width: 56,
    paddingTop: Spacing.md + 2,
    paddingRight: Spacing.sm,
  },
  timeText: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  kindRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  kindChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  kindChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    ...Typography.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
  },
  nowBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  nowBadgeText: {
    ...Typography.micro,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pastBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  pastBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  deleteBtn: {
    paddingTop: 2,
    paddingHorizontal: 2,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  description: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 18,
  },
});
