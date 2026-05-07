import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { TaskPriority } from '@/src/data/types';

type Props = { priority: TaskPriority };

// Réplica del badge legacy:
//   text-[9px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}
//   Alta:  text-error   bg-error/10
//   Media: text-secondary bg-secondary/10  (= primary indigo)
//   Baja:  text-outline  bg-outline/10
export function PriorityBadge({ priority }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const palette =
    priority === 'Alta'
      ? { bg: '#fee2e2', fg: c.danger }
      : priority === 'Media'
        ? { bg: c.surfaceTint, fg: c.primary }
        : { bg: c.surfaceMuted, fg: c.textMuted };

  return (
    <View style={[styles.box, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{priority}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
