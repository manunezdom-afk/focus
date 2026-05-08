import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  message: string;
  onRetry?: () => void;
};

// Banner sutil (no Alert modal) para errores de carga. Si onRetry está, muestra
// botón "Reintentar" inline. Útil para fallos de red sin asustar al usuario.
export function ErrorBanner({ message, onRetry }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: scheme === 'dark' ? '#3f1d1d' : '#fef2f2',
          borderColor: c.danger,
        },
      ]}
    >
      <Text style={[styles.text, { color: c.danger }]} numberOfLines={3}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.button,
            { opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: c.danger }]}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18 },
  button: { paddingHorizontal: 8, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  buttonText: { fontSize: 13, fontWeight: '600' },
});
