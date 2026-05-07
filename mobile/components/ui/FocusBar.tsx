import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type Props = {
  // Cuando el usuario manda el mensaje (botón send o submit del teclado).
  onSubmit: (text: string) => void;
  // Estado disabled global, ej. mientras Nova procesa.
  loading?: boolean;
  placeholder?: string;
};

// FocusBar: input "Habla con Nova…" inspirado directamente del legacy
// /src/components/FocusBar.jsx. Es la pieza central de Mi Día.
//
// Layout:
//   [📷] [TextInput "Habla con Nova…"] [🎙] [➤ enviar]
//
// - Cámara y mic están UI-listos pero deshabilitados (próximas fases).
// - Send se habilita cuando hay texto, alternativamente azul indigo.
// - Container con borde y bg surface, redondeado generosamente.
//
// Visual match legacy:
//   className="flex items-center gap-2 rounded-2xl border border-outline/20
//   bg-surface-container-lowest px-2 py-2"
//   placeholder text-outline/50 text-[16px]
//   send-button rounded-xl h-10 w-10 bg-primary text-white
export function FocusBar({ onSubmit, loading = false, placeholder = 'Habla con Nova…' }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !loading;

  function handleSend() {
    if (!canSend) return;
    if (Platform.OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSubmit(text.trim());
    setText('');
  }

  function comingSoon(feature: string) {
    Alert.alert(feature, 'Esta función estará disponible en la próxima versión.', [
      { text: 'Entendido' },
    ]);
  }

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      {/* Cámara — disabled, próximamente */}
      <Pressable
        onPress={() => comingSoon('Foto de agenda')}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: c.surfaceMuted,
            opacity: pressed ? 0.6 : 0.5,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Foto de agenda"
        accessibilityState={{ disabled: true }}
      >
        <IconSymbol name="plus" size={18} color={c.textSubtle} />
      </Pressable>

      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSend}
        placeholder={placeholder}
        placeholderTextColor={c.textSubtle}
        style={[styles.input, { color: c.text }]}
        editable={!loading}
        autoCorrect
        autoCapitalize="sentences"
        returnKeyType="send"
        blurOnSubmit
        multiline={false}
        maxLength={500}
      />

      {/* Mic — disabled, próximamente */}
      <Pressable
        onPress={() => comingSoon('Dictado')}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: 'transparent',
            opacity: pressed ? 0.6 : 0.5,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Dictar"
        accessibilityState={{ disabled: true }}
      >
        <IconSymbol name="sparkles" size={18} color={c.textSubtle} />
      </Pressable>

      {/* Send — primary cuando hay texto */}
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: canSend ? c.primary : c.surfaceMuted,
            opacity: !canSend ? 0.5 : pressed ? 0.85 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Enviar a Nova"
      >
        <IconSymbol
          name="arrow.up"
          size={18}
          color={canSend ? c.onPrimary : c.textSubtle}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: Radius.xl,
    borderWidth: 1,
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
