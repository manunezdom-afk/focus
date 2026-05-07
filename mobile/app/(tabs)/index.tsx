import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function MiDiaScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Screen title="Mi día" subtitle="Tu agenda y prioridades del día.">
      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Próximamente</Text>
          <Text style={[styles.cardBody, { color: c.textMuted }]}>
            Esta es la base de la app mobile en Expo. La pantalla &quot;Mi día&quot; mostrará tus eventos y tareas
            del día, igual que la web, en una próxima fase.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
});
