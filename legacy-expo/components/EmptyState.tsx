import { LinearGradient } from 'expo-linear-gradient';
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

// Empty state Gemini-style — círculo con gradiente cyan→azul→violeta,
// halo suave, título y descripción centrados.
export function EmptyState({ title, description, icon = 'sparkles', action }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.box}>
      <View style={styles.iconWrap}>
        <View style={[styles.halo, { backgroundColor: c.primaryContainer, opacity: scheme === 'dark' ? 0.4 : 0.55 }]} />
        <LinearGradient
          colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}
        >
          <IconSymbol name={icon} size={22} color="#ffffff" />
        </LinearGradient>
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
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  halo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  title: { ...Typography.title3, textAlign: 'center' },
  body: { ...Typography.body, textAlign: 'center', maxWidth: 320 },
  actionWrap: { marginTop: Spacing.md },
});
