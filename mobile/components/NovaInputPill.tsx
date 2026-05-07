import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Toda la pill es tappable. El destino habitual es la pantalla Nova,
  // pero lo dejamos abierto al caller — Mi Día decide si abre Nova con
  // o sin prompt prellenado.
  onPress: () => void;
};

// "Pill" de entrada a Nova. Visualmente es un input deshabilitado con
// ícono de cámara a la izquierda y de micrófono a la derecha. En realidad
// no captura voz/foto todavía: la pill entera dirige al chat de Nova.
// Cuando agreguemos voz/cámara, los íconos pueden volverse pressables
// independientes.
export function NovaInputPill({ onPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function handlePress() {
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Habla con Nova"
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: c.surfaceTint, borderColor: c.border },
        ]}
      >
        <IconSymbol name="camera.fill" size={20} color={c.primary} />
      </View>

      <Text style={[styles.placeholder, { color: c.textSubtle }]} numberOfLines={1}>
        Habla con Nova…
      </Text>

      <IconSymbol name="mic.fill" size={22} color={c.primary} style={styles.micIcon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: 6,
    paddingRight: Spacing.lg,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    flex: 1,
    ...Typography.body,
    fontSize: 16,
  },
  micIcon: {
    marginLeft: Spacing.xs,
  },
});
