import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Llamado al tocar un chip; el padre debe sembrar el FocusBar con `text`.
  // Hasta que el usuario toque enviar, NO se crean datos — son solo prompts.
  onPickPrompt: (text: string) => void;
};

// Iconos de los chips. Solo usamos íconos del MAPPING actual de
// icon-symbol.tsx para no introducir mappings nuevos.
const PROMPTS: { label: string; icon: 'sparkles' | 'calendar' | 'checklist' }[] = [
  { label: 'Planifica mi día', icon: 'sparkles' },
  { label: 'Agenda gym mañana a las 7', icon: 'calendar' },
  { label: 'Reserva 2h enfocadas esta tarde', icon: 'checklist' },
];

export function EmptyDayState({ onPickPrompt }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  // Sin pulse infinito acá — corría en UI thread incluso cuando esta
  // tab no estaba visible. Ícono estático, mismo look sin coste perf.

  return (
    <View style={styles.wrap}>
      {/* Intro centrada — espejo del legacy mobile: ícono + título humilde
          + descripción invitando a Nova. */}
      <View style={styles.intro}>
        <View style={[styles.iconCircle, { backgroundColor: c.primaryContainer }]}>
          <IconSymbol name="sparkles" size={22} color={c.primary} />
        </View>
        <Animated.Text
          style={[styles.title, { color: c.text }]}
        >
          Hoy está libre.
        </Animated.Text>
        <Animated.Text
          style={[styles.desc, { color: c.textMuted }]}
        >
          ¿Por dónde empezamos? Toca un ejemplo o escríbele a Nova.
        </Animated.Text>
      </View>

      {/* Chips con stagger: cada uno entra 60ms después del anterior */}
      <View style={styles.chipsCol}>
        {PROMPTS.map((p, idx) => (
          <Animated.View
            key={p.label}
          >
            <Pressable
              onPress={() => onPickPrompt(p.label)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={p.label}
            >
              <View style={[styles.chipIcon, { backgroundColor: c.primaryContainer }]}>
                <IconSymbol name={p.icon} size={16} color={c.primary} />
              </View>
              <Text style={[styles.chipText, { color: c.text }]} numberOfLines={1}>
                {p.label}
              </Text>
              <IconSymbol name="chevron.right" size={14} color={c.textSubtle} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  intro: {
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  desc: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  chipsCol: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  chipIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    flex: 1,
  },
});
