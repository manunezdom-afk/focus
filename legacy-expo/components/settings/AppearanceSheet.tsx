import * as Haptics from 'expo-haptics';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ThemePreference } from '@/src/lib/themePreference';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  selected: ThemePreference;
  onSelect: (next: ThemePreference) => Promise<void> | void;
};

type Option = {
  id: ThemePreference;
  title: string;
  desc: string;
  icon: React.ComponentProps<typeof IconSymbol>['name'];
};

const OPTIONS: Option[] = [
  {
    id: 'system',
    title: 'Sistema',
    desc: 'Sigue automáticamente la apariencia del iPhone.',
    icon: 'gearshape.fill',
  },
  {
    id: 'light',
    title: 'Claro',
    desc: 'Forzar fondo claro siempre, ignorando el sistema.',
    icon: 'sun.max.fill',
  },
  {
    id: 'dark',
    title: 'Oscuro',
    desc: 'Forzar fondo oscuro siempre, ignorando el sistema.',
    icon: 'sparkles',
  },
];

export function AppearanceSheet({ visible, onDismiss, selected, onSelect }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: c.surface }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.heading, { color: c.text }]}>Apariencia</Text>
          <Text style={[styles.subheading, { color: c.textMuted }]}>
            Aplica al instante. Tu preferencia queda guardada en el device.
          </Text>

          <View style={styles.optionsCol}>
            {OPTIONS.map((opt) => {
              const active = opt.id === selected;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => {
                    if (Platform.OS === 'ios') void Haptics.selectionAsync();
                    void onSelect(opt.id);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: active ? c.primaryContainer : c.surfaceMuted,
                      borderColor: active ? c.primary : c.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      { backgroundColor: active ? c.primary : c.surface },
                    ]}
                  >
                    <IconSymbol
                      name={opt.icon}
                      size={16}
                      color={active ? c.onPrimary : c.textSubtle}
                    />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionTitle, { color: c.text }]}>{opt.title}</Text>
                    <Text
                      style={[styles.optionDesc, { color: c.textMuted }]}
                      numberOfLines={2}
                    >
                      {opt.desc}
                    </Text>
                  </View>
                  {active ? (
                    <IconSymbol name="checkmark" size={16} color={c.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingBottom: Spacing['2xl'],
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  subheading: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  optionsCol: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  optionDesc: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
});
