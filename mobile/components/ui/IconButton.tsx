import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Variant = 'subtle' | 'filled' | 'tinted' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  iconName: React.ComponentProps<typeof IconSymbol>['name'];
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel: string;
};

// Botón circular con icono. Réplica del patrón legacy:
//   w-10 h-10 rounded-full bg-surface-container-low text-outline
//   y variantes filled (bg-primary) para FAB.
export function IconButton({
  iconName,
  onPress,
  variant = 'subtle',
  size = 'md',
  disabled = false,
  haptic = true,
  accessibilityLabel,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const dim = size === 'sm' ? 32 : size === 'lg' ? 56 : 40;
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20;

  let bg: string;
  let fg: string;
  switch (variant) {
    case 'filled':
      bg = c.primary;
      fg = c.onPrimary;
      break;
    case 'tinted':
      bg = c.surfaceTint;
      fg = c.primary;
      break;
    case 'ghost':
      bg = 'transparent';
      fg = c.textMuted;
      break;
    default:
      bg = c.surfaceMuted;
      fg = c.textMuted;
  }

  function handlePress() {
    if (disabled) return;
    if (haptic && Platform.OS === 'ios') {
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
          width: dim,
          height: dim,
          borderRadius: Radius.full,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      <IconSymbol name={iconName} size={iconSize} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
