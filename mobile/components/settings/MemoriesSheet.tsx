import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Alert,
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
import type { Memory } from '@/src/data/memories';

const CATEGORY_LABELS: Record<string, string> = {
  fact: 'Dato',
  relationship: 'Relación',
  preference: 'Preferencia',
  goal: 'Meta',
  pain: 'Dolor',
  routine: 'Rutina',
  context: 'Contexto',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

type Props = {
  visible: boolean;
  onDismiss: () => void;
  memories: Memory[];
  loading: boolean;
  onDelete: (id: string) => Promise<void> | void;
};

export function MemoriesSheet({ visible, onDismiss, memories, loading, onDelete }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  function confirmDelete(memory: Memory) {
    if (Platform.OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      '¿Olvidar este dato?',
      `Nova dejará de usar:\n\n"${memory.content}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Olvidar',
          style: 'destructive',
          onPress: () => void onDelete(memory.id),
        },
      ],
    );
  }

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
        <View style={styles.header}>
          <Text style={[styles.heading, { color: c.text }]}>Memorias de Nova</Text>
          <Text style={[styles.subheading, { color: c.textMuted }]}>
            Lo que Nova ha aprendido de ti. Toca el ícono para olvidar algo.
          </Text>
        </View>

        {loading && memories.length === 0 ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: c.primaryContainer }]}>
              <IconSymbol name="sparkles" size={20} color={c.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
              Nova aún no recuerda nada.
            </Text>
            <Text style={[styles.emptyDesc, { color: c.textMuted }]}>
              Cuando le cuentes algo personal en una conversación, lo guardará acá para usarlo en próximas charlas.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {memories.map((m) => (
              <View
                key={m.id}
                style={[styles.row, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
              >
                <View style={styles.rowBody}>
                  <View style={styles.rowMetaRow}>
                    <View
                      style={[styles.categoryChip, { backgroundColor: c.primaryContainer }]}
                    >
                      <Text style={[styles.categoryChipText, { color: c.primary }]}>
                        {CATEGORY_LABELS[m.category] ?? m.category}
                      </Text>
                    </View>
                    {m.subject ? (
                      <Text style={[styles.subjectText, { color: c.textMuted }]} numberOfLines={1}>
                        · {m.subject}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.contentText, { color: c.text }]} numberOfLines={4}>
                    {m.content}
                  </Text>
                  <Text style={[styles.confidenceText, { color: c.textSubtle }]}>
                    Confianza: {CONFIDENCE_LABELS[m.confidence] ?? m.confidence}
                  </Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(m)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { opacity: pressed ? 0.5 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Olvidar: ${m.content.slice(0, 40)}`}
                >
                  <IconSymbol name="trash" size={16} color="#dc2626" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.footer}>
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
        </View>
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
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: 4,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  loaderWrap: {
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
  },
  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  contentText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '500',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  closeBtn: {
    height: 44,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
