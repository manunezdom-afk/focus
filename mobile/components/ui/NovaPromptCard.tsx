import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  title: string;
  description: string;
};

// Réplica casi exacta del card "Tu agenda de hoy está vacía" del legacy DayView:
//   className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3.5
//   flex items-start gap-3"
//   icono auto_awesome (text-primary text-[20px] mt-0.5) +
//   título text-[13.5px] font-semibold leading-snug +
//   sub text-[12px] text-outline mt-0.5 leading-snug
export function NovaPromptCard({ title, description }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: c.surfaceTint, borderColor: c.border },
      ]}
    >
      <IconSymbol name="sparkles" size={20} color={c.primary} style={styles.icon} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.desc, { color: c.textMuted }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { marginTop: 2 },
  body: { flex: 1, gap: 2 },
  title: { ...Typography.bodyStrong, fontSize: 13.5, lineHeight: 18 },
  desc: { ...Typography.caption, fontSize: 12, lineHeight: 16 },
});
