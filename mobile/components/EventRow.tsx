import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem } from '@/src/data/types';

type Props = {
  event: EventItem;
};

// Formatea "HH:MM - HH:MM" en parts (start, end).
function parseTime(time: string): { start: string; end: string | null } {
  if (!time) return { start: '', end: null };
  const cleaned = time.replace(/\s/g, '');
  const m = cleaned.match(/^(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?$/);
  if (!m) return { start: time, end: null };
  return { start: m[1], end: m[2] || null };
}

// Etiqueta corta de "section" para mostrar como tag visual ("trabajo", "salud"…)
function sectionLabel(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function EventRow({ event }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { start, end } = parseTime(event.time);

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: c.surface, borderBottomColor: c.border },
      ]}
    >
      {/* Indicador color a la izquierda — featured usa el gradiente Nova
          (cyan→azul→violeta), no-featured queda neutro. */}
      {event.featured ? (
        <LinearGradient
          colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bar}
        />
      ) : (
        <View style={[styles.bar, { backgroundColor: c.borderStrong }]} />
      )}

      <View style={styles.timeCol}>
        <Text style={[styles.startTime, { color: start ? c.text : c.textMuted }]}>
          {start || '—'}
        </Text>
        {end ? (
          <Text style={[styles.endTime, { color: c.textSubtle }]}>{end}</Text>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        {event.description ? (
          <Text style={[styles.description, { color: c.textMuted }]} numberOfLines={1}>
            {event.description}
          </Text>
        ) : null}
        {event.section ? (
          <View
            style={[
              styles.tag,
              { backgroundColor: c.surfaceTint, borderColor: c.border },
            ]}
          >
            <Text style={[styles.tagText, { color: c.primary }]}>
              {sectionLabel(event.section)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 60,
    alignItems: 'flex-start',
  },
  bar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginVertical: 4,
  },
  timeCol: {
    width: 56,
    paddingTop: 2,
  },
  startTime: {
    ...Typography.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
  endTime: {
    ...Typography.caption,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  body: { flex: 1, gap: 4 },
  title: { ...Typography.body, fontSize: 16, lineHeight: 22 },
  description: { ...Typography.caption },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.xs,
  },
  tagText: { ...Typography.micro, fontWeight: '700' },
});
