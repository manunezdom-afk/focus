import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { NovaPersonality } from '@/src/data/userProfile';

type Option = {
  id: NovaPersonality;
  title: string;
  short: string;
  desc: string;
  example: string;
};

// Las descripciones espejan el system prompt de api/_lib/personality.js
// para que lo que ve el usuario en la UI coincida con cómo Nova le habla.
const OPTIONS: Option[] = [
  {
    id: 'focus',
    title: 'Enfocado',
    short: 'Directa, sin relleno',
    desc: 'Frases cortas, verbos claros. Ejecuta antes que explicar.',
    example: '"Listo, agendé Standup de 9:00 a 9:15."',
  },
  {
    id: 'cercana',
    title: 'Cercana',
    short: 'Cálida, humana',
    desc: 'Como un colega que acompaña. Conectores cortos cuando suena natural.',
    example: '"Perfecto, te dejé el Standup de 9:00 a 9:15 listo para mañana."',
  },
  {
    id: 'estrategica',
    title: 'Estratégica',
    short: 'Analítica, con razón',
    desc: 'Suma el porqué cuando aporta. Menciona prioridad, estructura, motivo.',
    example: '"Programé Standup 9:00–9:15, temprano para no chocar con el bloque de 10."',
  },
];

type Props = {
  visible: boolean;
  onDismiss: () => void;
  selected: NovaPersonality;
  saving: boolean;
  onSelect: (personality: NovaPersonality) => Promise<void> | void;
};

export function PersonalitySheet({ visible, onDismiss, selected, saving, onSelect }: Props) {
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
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={[styles.sheet, { backgroundColor: c.surface }]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.heading, { color: c.text }]}>Personalidad de Nova</Text>
          <Text style={[styles.subheading, { color: c.textMuted }]}>
            Elige cómo te habla. Cambia solo el tono — nunca cambia los hechos ni las acciones.
          </Text>

          {OPTIONS.map((opt) => {
            const active = opt.id === selected;
            return (
              <Pressable
                key={opt.id}
                onPress={async () => {
                  if (active || saving) return;
                  if (Platform.OS === 'ios') void Haptics.selectionAsync();
                  await onSelect(opt.id);
                }}
                disabled={saving}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: active ? c.primaryContainer : c.surfaceMuted,
                    borderColor: active ? c.primary : c.border,
                    opacity: pressed && !active ? 0.7 : 1,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${opt.title}: ${opt.short}`}
              >
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionTitle, { color: active ? c.primary : c.text }]}>
                    {opt.title}
                  </Text>
                  {active ? (
                    <View style={[styles.activeBadge, { backgroundColor: c.primary }]}>
                      {saving ? (
                        <ActivityIndicator color={c.onPrimary} size="small" />
                      ) : (
                        <IconSymbol name="checkmark" size={11} color={c.onPrimary} />
                      )}
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.optionShort, { color: c.textMuted }]}>{opt.short}</Text>
                <Text style={[styles.optionDesc, { color: c.text }]}>{opt.desc}</Text>
                <Text style={[styles.optionExample, { color: c.textSubtle }]}>
                  {opt.example}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.closeBtn,
              { borderColor: c.border, opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
          >
            <Text style={[styles.closeBtnText, { color: c.textMuted }]}>Cerrar</Text>
          </Pressable>
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
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingBottom: Spacing['2xl'],
    maxHeight: '90%',
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
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  option: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: 4,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionShort: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    marginTop: 2,
  },
  optionExample: {
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 4,
  },
  closeBtn: {
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
