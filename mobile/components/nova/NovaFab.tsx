import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Override del onPress por si una pantalla quiere setear seed antes de
  // navegar. Por defecto: ir a /(tabs)/nova con haptic + selectionAsync.
  onPress?: () => void;
  // Por si una pantalla quiere ocultarlo (ej. la propia Nova).
  hidden?: boolean;
};

export function NovaFab({ onPress, hidden }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  if (hidden) return null;

  function handlePress() {
    if (Platform.OS === 'ios') void Haptics.selectionAsync();
    if (onPress) {
      onPress();
    } else {
      router.push('/(tabs)/nova');
    }
  }

  return (
    <Animated.View entering={FadeInDown.delay(160).duration(360)} style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? c.primaryPressed : c.primary,
            shadowColor: c.primary,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Abrir Nova"
      >
        <IconSymbol name="sparkles" size={15} color={c.onPrimary} />
        <Text style={[styles.text, { color: c.onPrimary }]}>Nova</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 96,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: Radius.full,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
