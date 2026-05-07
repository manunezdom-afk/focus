import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { EventItem } from '@/src/data/types';

type Props = {
  event: EventItem;
};

// Formatea "HH:MM - HH:MM" → "HH:MM" (mostramos solo el inicio en filas
// densas; la duración irá en la pantalla de detalle más adelante).
function startTime(time: string): string {
  if (!time) return '';
  const m = time.match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : time;
}

export function EventRow({ event }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const time = startTime(event.time);

  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: time ? c.text : c.textMuted }]}>
          {time || '—'}
        </Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  timeCol: {
    width: 60,
    paddingTop: 2,
  },
  time: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 16, lineHeight: 22 },
  description: { fontSize: 13, lineHeight: 18 },
});
