import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChatMessage } from '@/src/data/nova';

type Props = {
  message: ChatMessage;
};

// Un mensaje del chat con Nova. El de Nova alinea izquierda con surface tinted,
// el del usuario alinea derecha con primary. Mantiene compatibilidad con dark.
// Mientras Nova "piensa", muestra un spinner pequeño en la burbuja. Si la
// respuesta del assistant aplicó acciones (add_event/add_task), las muestra
// como chips primary debajo del texto.
export function ChatBubble({ message }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isUser = message.role === 'user';
  const isSending = message.status === 'sending';
  const isError = message.status === 'error';

  const bg = isUser
    ? c.primary
    : isError
      ? c.surfaceMuted
      : c.surfaceTint;
  const fg = isUser ? c.onPrimary : isError ? c.danger : c.text;
  const hasActions = !!message.appliedActions && message.appliedActions.length > 0;

  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          { backgroundColor: bg, borderColor: isUser ? c.primary : c.border },
        ]}
      >
        {isSending && !message.content ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={fg} />
            <Text style={[styles.thinkingText, { color: fg }]}>Nova está pensando...</Text>
          </View>
        ) : (
          <Text style={[styles.text, { color: fg }]} selectable>
            {message.content}
          </Text>
        )}

        {hasActions ? (
          <View style={styles.chipsRow}>
            {message.appliedActions!.map((label, idx) => (
              <View
                key={`${label}-${idx}`}
                style={[styles.chip, { backgroundColor: c.primaryContainer }]}
              >
                <Text style={[styles.chipText, { color: c.primary }]}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleUser: {
    borderBottomRightRadius: Radius.sm,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: Radius.sm,
  },
  text: {
    ...Typography.body,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thinkingText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
