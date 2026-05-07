import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  label: string;
  iconName: React.ComponentProps<typeof IconSymbol>['name'];
  onPress: () => void;
  disabled?: boolean;
};

// Cada botón del grid 2-cols del empty state legacy de DayView:
//   className="flex items-center gap-2 rounded-2xl bg-surface-container-low
//   border border-outline-variant/30 px-3.5 py-3"
//   icono text-primary text-[20px] + label text-[13px] font-semibold
export function QuickActionButton({ label, iconName, onPress, disabled = false }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function handlePress() {
    if (disabled) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.box,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconSymbol name={iconName} size={20} color={c.primary} />
      <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  label: {
    ...Typography.caption,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
