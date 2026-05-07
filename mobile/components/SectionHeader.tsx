import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  title: string;
  count?: number;
};

export function SectionHeader({ title, count }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.box, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.textMuted }]}>
        {title}
        {typeof count === 'number' ? `  ·  ${count}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
