import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Llamado al tocar un chip; el padre debe sembrar el FocusBar con `text`.
  // Hasta que el usuario toque enviar, NO se crean datos — son solo prompts.
  onPickPrompt: (text: string) => void;
};

// Iconos de los chips. Solo usamos íconos del MAPPING actual de
// icon-symbol.tsx para no introducir mappings nuevos.
const PROMPTS: Array<{ label: string; icon: 'sparkles' | 'calendar' | 'checklist' }> = [
  { label: 'Planifica mi día', icon: 'sparkles' },
  { label: 'Agenda gym mañana a las 7', icon: 'calendar' },
  { label: 'Reserva 2h enfocadas esta tarde', icon: 'checklist' },
];

export function EmptyDayState({ onPickPrompt }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.wrap}>
      {/* Intro centrada — espejo del legacy mobile: ícono + título humilde
          + descripción invitando a Nova. */}
      <View style={styles.intro}>
        <View style={[styles.iconCircle, { backgroundColor: c.primaryContainer }]}>
          <IconSymbol name="sparkles" size={22} color={c.primary} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>Hoy está libre.</Text>
        <Text style={[styles.desc, { color: c.textMuted }]}>
          ¿Por dónde empezamos? Toca un ejemplo o escríbele a Nova.
        </Text>
      </View>

      {/* Chips: icon-circle + label flex + chevron derecha */}
      <View style={styles.chipsCol}>
        {PROMPTS.map((p) => (
          <Pressable
            key={p.label}
            onPress={() => onPickPrompt(p.label)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={p.label}
          >
            <View style={[styles.chipIcon, { backgroundColor: c.primaryContainer }]}>
              <IconSymbol name={p.icon} size={14} color={c.primary} />
            </View>
            <Text style={[styles.chipText, { color: c.text }]} numberOfLines={1}>
              {p.label}
            </Text>
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
    gap: Spacing.xl,
    paddingTop: Spacing.md,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    ...Typography.title3,
    fontSize: 18,
    textAlign: 'center',
  },
  desc: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
  },
  chipsCol: {
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  chipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...Typography.body,
    fontSize: 14,
    flex: 1,
  },
});
