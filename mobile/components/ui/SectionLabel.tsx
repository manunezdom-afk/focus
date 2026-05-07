import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  label: string;
  count?: number;
  // Padding horizontal manual cuando se necesita inset distinto al default.
  style?: StyleProp<ViewStyle>;
};

// Label de sección estilo iOS list / legacy SettingsView SectionCard.
// Match: text-[10.5px] font-bold uppercase tracking-[0.12em] text-slate-400
// Cuando hay count, badge pequeño con el número.
export function SectionLabel({ label, count, style }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.label, { color: c.textSubtle }]}>{label}</Text>
      {typeof count === 'number' ? (
        <View style={[styles.badge, { backgroundColor: c.surfaceTint }]}>
          <Text style={[styles.badgeText, { color: c.primary }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
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
