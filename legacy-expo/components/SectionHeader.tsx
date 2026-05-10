import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  title: string;
  count?: number;
};

// Estilo "iOS list section" — uppercase tracked, color subtle.
// Padding reducido vs el original para mejor densidad mobile.
export function SectionHeader({ title, count }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.box, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.textSubtle }]}>
        {title}
      </Text>
      {typeof count === 'number' ? (
        <View style={[styles.badge, { backgroundColor: c.surfaceTint }]}>
          <Text style={[styles.badgeText, { color: c.primary }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.micro,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
