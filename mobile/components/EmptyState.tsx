import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.box}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.body, { color: c.textMuted }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
