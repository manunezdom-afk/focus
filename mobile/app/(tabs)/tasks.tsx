import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TasksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Screen title="Tareas" subtitle="Tu lista de pendientes.">
      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.cardTitle, { color: c.text }]}>En camino</Text>
          <Text style={[styles.cardBody, { color: c.textMuted }]}>
            Pronto podrás crear, completar y reordenar tareas con gestos nativos. Esta pantalla
            existe ahora solo para validar la base mobile.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 20 },
});
