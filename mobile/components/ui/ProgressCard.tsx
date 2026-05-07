import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  done: number;
  total: number;
  label?: string;
};

// Card "Progreso de hoy" — réplica del de TasksView legacy:
//   bg-surface-container-lowest p-5 rounded-[24px] border border-outline-variant/20
//   "Progreso de hoy" + "X / N completadas" + barra h-2 con fill primary
export function ProgressCard({ done, total, label = 'Progreso de hoy' }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const safeTotal = total > 0 ? total : 0;
  const percent = safeTotal === 0 ? 0 : Math.round((done / safeTotal) * 100);
  const allDone = safeTotal > 0 && done === safeTotal;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
        <Text style={[styles.count, { color: c.primary }]}>
          {done} / {safeTotal} completadas
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: c.primary,
              width: `${percent}%`,
            },
          ]}
        />
      </View>
      {allDone ? (
        <View style={styles.celebrateRow}>
          <IconSymbol name="sparkles" size={14} color={c.primary} />
          <Text style={[styles.celebrate, { color: c.primary }]}>
            ¡Todas las tareas de hoy completadas!
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius['2xl'], // 22px ≈ legacy [24px]
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: { ...Typography.bodyStrong, fontSize: 14 },
  count: { ...Typography.bodyStrong, fontSize: 14 },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  celebrateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  celebrate: { ...Typography.caption, fontWeight: '700' },
});
