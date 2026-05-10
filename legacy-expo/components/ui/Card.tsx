import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Variant = 'default' | 'tinted' | 'outline';

type Props = {
  children: ReactNode;
  variant?: Variant;
  // Sin padding por defecto cuando wrap-list (FlatList rows ya tienen padding).
  // Usamos `interior` para darle padding cuando es card de contenido suelto.
  interior?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Card replica el patrón legacy:
// - default → bg-surface-container-lowest border outline-variant/20
// - tinted  → bg-primary/5 border-primary/15 (Nova prompt)
// - outline → bg-surface-container border outline-variant/30
//
// Todas con rounded-[20px] = Radius.xl.
export function Card({ children, variant = 'default', interior = false, style }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const palette =
    variant === 'tinted'
      ? { bg: c.surfaceTint, border: c.border }
      : variant === 'outline'
        ? { bg: c.surfaceMuted, border: c.borderStrong }
        : { bg: c.surface, border: c.border };

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: palette.bg, borderColor: palette.border },
        interior ? styles.interior : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: Radius.xl, // 18px — match legacy ~20px feel
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  interior: {
    padding: Spacing.lg,
  },
});
