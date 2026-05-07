import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  iconName: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
};

// Chip de "sugerencia" — pill ancho con ícono tinted a la izquierda,
// label bold al medio y flechita ↗ a la derecha. Pensado para el empty
// state de Mi Día: cada chip es un prompt que va al chat de Nova.
export function SuggestionChip({ iconName, label, onPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function handlePress() {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: c.surfaceTint, borderColor: c.border },
        ]}
      >
        <IconSymbol name={iconName} size={18} color={c.primary} />
      </View>

      <Text style={[styles.label, { color: c.text }]} numberOfLines={1}>
        {label}
      </Text>

      <IconSymbol name="arrow.up.right" size={16} color={c.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: 8,
    paddingRight: Spacing.lg,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    ...Typography.body,
    fontSize: 16,
    fontWeight: '600',
  },
});
