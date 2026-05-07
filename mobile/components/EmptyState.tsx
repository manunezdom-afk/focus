import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  title: string;
  description?: string;
  icon?: 'sparkles' | 'sun.max.fill' | 'calendar' | 'checklist';
  action?: ReactNode;
};

// Empty state premium — círculo tinted con icon, título y descripción
// centrados. Si se pasa `action`, se renderiza debajo del texto.
export function EmptyState({ title, description, icon = 'sparkles', action }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.box}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: c.surfaceTint, borderColor: c.border },
        ]}
      >
        <IconSymbol name={icon} size={24} color={c.primary} />
      </View>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.body, { color: c.textMuted }]}>{description}</Text>
      ) : null}
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.xs,
  },
  title: { ...Typography.title3, textAlign: 'center' },
  body: { ...Typography.body, textAlign: 'center', maxWidth: 320 },
  actionWrap: { marginTop: Spacing.md },
});
