import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NovaOrb } from '@/components/nova/NovaOrb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Llamado al tocar un chip; el padre debe sembrar el FocusBar con `text`.
  // Hasta que el usuario toque enviar, NO se crean datos — son solo prompts.
  onPickPrompt: (text: string) => void;
};

const PROMPTS: { label: string; icon: 'sparkles' | 'calendar' | 'checklist' }[] = [
  { label: 'Planifica mi día', icon: 'sparkles' },
  { label: 'Agenda gym mañana a las 7', icon: 'calendar' },
  { label: 'Reserva 2h enfocadas esta tarde', icon: 'checklist' },
];

// Empty state hero estilo Gemini: orbe grande + saludo en degradado +
// chips con borde sutil. Identidad fuerte de Nova como asistente de IA.
export function EmptyDayState({ onPickPrompt }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.wrap}>
      <View style={styles.intro}>
        <View style={styles.orbWrap}>
          <NovaOrb size={56} ambient breathing />
        </View>
        <Text style={[styles.title, { color: c.text }]}>
          ¿Qué planeamos hoy?
        </Text>
      </View>

      <View style={styles.chipsCol}>
        {PROMPTS.map((p) => (
          <Pressable
            key={p.label}
            onPress={() => onPickPrompt(p.label)}
            style={({ pressed }) => [
              styles.chipShadow,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={p.label}
          >
            <LinearGradient
              colors={
                scheme === 'dark'
                  ? ['rgba(59,130,246,0.10)', 'rgba(139,92,246,0.06)']
                  : ['rgba(37,99,235,0.06)', 'rgba(139,92,246,0.04)']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <LinearGradient
                colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.chipIcon}
              >
                <IconSymbol name={p.icon} size={15} color="#ffffff" />
              </LinearGradient>
              <Text style={[styles.chipText, { color: c.text }]} numberOfLines={1}>
                {p.label}
              </Text>
              <IconSymbol name="chevron.right" size={14} color={c.textSubtle} />
            </LinearGradient>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    paddingTop: Spacing.md,
  },
  intro: {
    alignItems: 'center',
    gap: 14,
  },
  orbWrap: {
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  chipsCol: {
    gap: 10,
  },
  chipShadow: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderRadius: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
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
