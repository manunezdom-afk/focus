import { ScrollView, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ScreenProps = ViewProps & {
  title?: string;
  subtitle?: string;
  scroll?: boolean;
};

// Wrapper compartido para las pantallas de tabs. Maneja:
// - SafeAreaView con edges top (la tab bar ya empuja el bottom).
// - Header con título grande tipo iOS Large Title (versión simple, no
//   colapsable; cuando agreguemos contenido real podemos cambiar a
//   `Stack.Screen options={{ headerLargeTitle: true }}`).
// - Background del tema actual.
export function Screen({ title, subtitle, scroll = false, children, style, ...rest }: ScreenProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const Body = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Body
        style={[styles.body, style]}
        contentContainerStyle={scroll ? styles.scrollContent : undefined}
        {...rest}
      >
        {title ? (
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: c.textMuted }]}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
