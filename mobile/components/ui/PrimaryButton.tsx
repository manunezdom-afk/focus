import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'primary' | 'tinted' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  size?: Size;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  // Icono opcional a la izquierda del label.
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
};

// PrimaryButton es la pieza estándar de acción.
// - sm: pill compacta (px-3 py-1.5 text-xs) → para chips de header
// - md: pill mediana (px-4 py-2 text-xs)   → "Añadir" en Mi Día legacy
// - lg: full-width grande (px-5 py-4)      → CTAs primarios (login)
//
// variant primary = bg-primary on-primary text
// variant tinted  = bg-primary/10 text-primary (chips)
// variant ghost   = transparente con texto primary
// variant danger  = border red, text red (outline)
export function PrimaryButton({
  label,
  onPress,
  size = 'md',
  variant = 'primary',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  haptic = true,
  accessibilityLabel,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const sizeStyle =
    size === 'sm'
      ? styles.sizeSm
      : size === 'lg'
        ? styles.sizeLg
        : styles.sizeMd;

  const fontSize = size === 'lg' ? 16 : 13;
  const fontWeight = size === 'lg' ? ('600' as const) : ('700' as const);

  let bg: string;
  let fg: string;
  let borderColor: string | undefined;
  switch (variant) {
    case 'tinted':
      bg = c.surfaceTint;
      fg = c.primary;
      borderColor = c.border;
      break;
    case 'ghost':
      bg = 'transparent';
      fg = c.primary;
      borderColor = undefined;
      break;
    case 'danger':
      bg = 'transparent';
      fg = c.danger;
      borderColor = c.danger;
      break;
    default:
      bg = c.primary;
      fg = c.onPrimary;
      borderColor = undefined;
  }

  function handlePress() {
    if (disabled || loading) return;
    if (haptic && Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        sizeStyle,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          borderColor,
          borderWidth: borderColor ? 1 : 0,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text style={{ color: fg, fontSize, fontWeight }}>{label}</Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
  },
  sizeSm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minHeight: 32,
  },
  sizeMd: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 38,
  },
  sizeLg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    minHeight: 52,
    borderRadius: Radius.lg, // legacy: rounded-2xl en login (16px) en vez de pill
  },
  iconLeft: { marginRight: Spacing.xs },
  iconRight: { marginLeft: Spacing.xs },
});
