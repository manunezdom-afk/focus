import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Eyebrow: línea pequeña arriba del título, color primary (indigo).
  // Ej: "Hoy", "Buenos días", el año, etc.
  eyebrow?: string;
  // Título grande extrabold (32-36px). Se capitalizan opcionalmente.
  title: string;
  capitalize?: boolean;
  // Subtítulo opcional bajo el título, en gris.
  subtitle?: string;
  // Acción opcional alineada a la derecha (pill button, icon, etc).
  rightAction?: ReactNode;
};

// Espejo del header de DayView/TasksView del legacy: eyebrow primary +
// título extrabold ~36px. La diferencia con el header anterior de mobile es
// que el subtítulo va ARRIBA y en color primary (no abajo en gris).
export function ScreenHeader({ eyebrow, title, capitalize = false, subtitle, rightAction }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: c.primary }]} numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text
            style={[
              styles.title,
              { color: c.text },
              capitalize ? styles.capitalize : null,
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  textCol: { flex: 1 },
  rightAction: { paddingBottom: 4 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 4,
  },
  title: {
    // text-3xl sm:text-4xl font-extrabold = 30-36px / 800.
    // En mobile elegimos 32px con leading 38 — leíble en iPhone Mini sin
    // pasarse de la safe area.
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  capitalize: { textTransform: 'capitalize' },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
});
