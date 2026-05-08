import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  label?: string;
};

export function LoadingState({ label = 'Cargando...' }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.box}>
      <ActivityIndicator color={c.primary} />
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View style={styles.skeletonCol} pointerEvents="none">
        <View style={[styles.skeletonLine, { backgroundColor: c.surfaceMuted, width: 180 }]} />
        <View style={[styles.skeletonLine, { backgroundColor: c.surfaceMuted, width: 132 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
  },
  skeletonCol: {
    gap: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  skeletonLine: {
    height: 8,
    borderRadius: Radius.full,
    opacity: 0.55,
  },
});
