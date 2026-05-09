import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { GeminiSurface } from '@/components/ui/GeminiSurface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Empty state de la Bandeja: celebratorio, no triste. Patrón Sunsama
// "Inbox zero" — no hay nada y eso significa que estás al día.
//
// Visual: GeminiSurface (mismo gradient que el resto) + icono central con
// LinearGradient brand para mantener jerarquía con la pantalla.
export function InboxEmpty() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.wrap}>
      <GeminiSurface variant="card" radius={Radius.xl} style={styles.card}>
        <View style={styles.cardInner}>
          <LinearGradient
            colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBig}
          >
            <IconSymbol name="checkmark" size={28} color="#ffffff" />
          </LinearGradient>
          <Text style={[styles.title, { color: c.text }]}>Estás al día</Text>
          <Text style={[styles.body, { color: c.textMuted }]}>
            Sin sugerencias pendientes. Nova vuelve cuando vea algo que valga la pena revisar.
          </Text>
        </View>
      </GeminiSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  card: {
    alignSelf: 'stretch',
  },
  cardInner: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBig: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    textAlign: 'center',
    maxWidth: 320,
  },
});
