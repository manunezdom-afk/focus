import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { ChatMessage } from '@/src/data/nova';

type Props = {
  message: ChatMessage;
};

// Un mensaje del chat con Nova. El de Nova alinea izquierda con surface tinted,
// el del usuario alinea derecha con primary. Mantiene compatibilidad con dark.
// Mientras Nova "piensa", muestra un spinner pequeño en la burbuja.
export function ChatBubble({ message }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isUser = message.role === 'user';
  const isSending = message.status === 'sending';
  const isError = message.status === 'error';

  // Color de texto y fondo según rol
  const bg = isUser
    ? c.primary
    : isError
      ? c.surfaceMuted
      : c.surfaceTint;
  const fg = isUser ? c.onPrimary : isError ? c.danger : c.text;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          { backgroundColor: bg, borderColor: isUser ? c.primary : c.border },
        ]}
      >
        {isSending && !message.content ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <Text style={[styles.text, { color: fg }]} selectable>
            {message.content}
          </Text>
        )}
      </View>
    </View>
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
});
