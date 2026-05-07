import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Réplica de SectionCard + Row del legacy SettingsView:
//   SectionCard: bg-white rounded-[20px] border border-slate-100 shadow-sm
//                title px-5 pt-4 pb-2.5 text-[10.5px] font-bold uppercase
//                tracking-[0.12em] text-slate-400
//   Row:         flex items-center gap-3 px-5 py-3.5 border-t border-slate-50
//                first:border-t-0
//                icon text-[20px] text-slate-400
//                label text-[13.5px] font-semibold text-slate-800
//                sub   text-[11.5px] text-slate-400

type SectionProps = {
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SettingsSection({ title, children, style }: SectionProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: c.surface, borderColor: c.border },
        style,
      ]}
    >
      <Text style={[styles.sectionTitle, { color: c.textSubtle }]}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

type RowProps = {
  iconName: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  sub?: string;
  onPress?: () => void;
  danger?: boolean;
  // Slot derecho — chevron, switch, etc.
  trailing?: ReactNode;
  isFirst?: boolean;
};

export function SettingsRow({
  iconName,
  label,
  sub,
  onPress,
  danger,
  trailing,
  isFirst = false,
}: RowProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const labelColor = danger ? c.danger : c.text;
  const iconColor = danger ? c.danger : c.textSubtle;

  const content = (
    <View
      style={[
        styles.row,
        !isFirst && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
      ]}
    >
      <IconSymbol name={iconName} size={20} color={iconColor} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.rowSub, { color: c.textSubtle }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? (
        <IconSymbol name="chevron.right" size={16} color={c.textSubtle} />
      ) : null)}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: c.surfaceMuted }}
      style={({ pressed }) => ({
        backgroundColor: pressed ? c.surfaceMuted : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: Radius.xl, // ~18px ≈ legacy 20px
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionTitle: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 14,
    paddingBottom: 10,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowText: { flex: 1 },
  rowLabel: { ...Typography.body, fontSize: 13.5, fontWeight: '600' },
  rowSub: { ...Typography.caption, fontSize: 11.5, marginTop: 2 },
});
