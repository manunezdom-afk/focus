import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Llamado al tocar un chip; el padre debe sembrar el FocusBar con `text`.
  onPickPrompt: (text: string) => void;
};

const PROMPTS = [
  'Planifica mi día',
  'Agenda gym mañana a las 7',
  'Reserva 2h enfocadas esta tarde',
];

export function EmptyDayState({ onPickPrompt }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.wrap}>
      <View style={[styles.banner, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: c.primaryContainer }]}>
          <IconSymbol name="sparkles" size={18} color={c.primary} />
        </View>
        <View style={styles.bannerCol}>
          <Text style={[styles.title, { color: c.text }]}>Día libre — ¿qué agendamos?</Text>
          <Text style={[styles.desc, { color: c.textMuted }]}>
            Escríbele a Nova arriba o usa una de estas ideas.
          </Text>
        </View>
      </View>

      <View style={styles.chipsCol}>
        {PROMPTS.map((p) => (
          <Pressable
            key={p}
            onPress={() => onPickPrompt(p)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={p}
          >
            <Text style={[styles.chipText, { color: c.text }]}>{p}</Text>
            <IconSymbol name="chevron.right" size={14} color={c.textSubtle} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCol: {
    flex: 1,
  },
  title: {
    ...Typography.bodyStrong,
  },
  desc: {
    ...Typography.caption,
    marginTop: 2,
  },
  chipsCol: {
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  chipText: {
    ...Typography.body,
    flex: 1,
  },
});
