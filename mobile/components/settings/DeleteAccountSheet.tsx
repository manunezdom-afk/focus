import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteAccount } from '@/src/data/userPlan';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => Promise<void> | void; // Padre debe correr signOut local.
};

const REQUIRED_PHRASE = 'ELIMINAR';

// Modal de confirmación severa para borrar la cuenta. Doble cinturón:
//   1. Alert previo (lo dispara Settings)  → "¿estás seguro?"
//   2. Esta hoja  → debes tipear "ELIMINAR" para activar el botón.
//
// El endpoint server (api/auth/delete-account.js) hace la operación
// destructiva: `admin.auth.admin.deleteUser(userId)` cascadea TODO
// (events, tasks, memorias, ai_usage, user_plans, etc) por las
// REFERENCES auth.users(id) ON DELETE CASCADE en cada tabla. No hay
// soft-delete: requirement de App Store y de GDPR/CCPA.
export function DeleteAccountSheet({ visible, onDismiss, onSuccess }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset cuando la hoja se cierra/abre.
  useEffect(() => {
    if (!visible) {
      setPhrase('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const matches = phrase.trim().toUpperCase() === REQUIRED_PHRASE;
  const canConfirm = matches && !submitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    if (Platform.OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    const result = await deleteAccount();
    if (result.ok) {
      // Cierre haptics + delegamos al padre el signOut local. AuthGate
      // del root layout detectará session=null y redirigirá a /login.
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      try {
        await onSuccess();
      } finally {
        // No reseteamos submitting acá — la pantalla ya está navegando a
        // login y este modal se desmonta con la sesión nueva.
      }
      return;
    }
    setError(result.message);
    setSubmitting(false);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={submitting ? undefined : onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={submitting ? undefined : onDismiss}
        accessibilityLabel="Cerrar"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kbd}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <View style={[styles.iconWrap, { backgroundColor: '#fee2e2' }]}>
              <IconSymbol name="trash.fill" size={26} color={'#dc2626'} />
            </View>
            <Text style={[styles.heading, { color: c.text }]}>Eliminar cuenta</Text>
            <Text style={[styles.subheading, { color: c.textMuted }]}>
              Esta acción es <Text style={styles.bold}>permanente e irreversible</Text>. Se
              eliminarán tu cuenta y todos tus datos: eventos, tareas, memorias de Nova,
              uso de IA y configuración. No podemos recuperarlos después.
            </Text>

            <View style={[styles.warnBox, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
              <Text style={[styles.warnTitle, { color: c.text }]}>Para confirmar, escribe:</Text>
              <Text style={[styles.warnPhrase, { color: '#dc2626' }]}>{REQUIRED_PHRASE}</Text>
            </View>

            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              placeholder={REQUIRED_PHRASE}
              placeholderTextColor={c.textSubtle}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              editable={!submitting}
              maxLength={20}
              style={[
                styles.input,
                {
                  color: c.text,
                  borderColor: matches ? '#dc2626' : c.border,
                  backgroundColor: c.surfaceMuted,
                },
              ]}
              accessibilityLabel="Confirmación de eliminación"
            />

            {error ? (
              <View style={[styles.errorBox, { borderColor: '#fecaca', backgroundColor: '#fef2f2' }]}>
                <IconSymbol name="xmark" size={14} color={'#dc2626'} />
                <Text style={[styles.errorText, { color: '#dc2626' }]} numberOfLines={3}>
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={handleConfirm}
                disabled={!canConfirm}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  {
                    backgroundColor: canConfirm
                      ? pressed
                        ? '#b91c1c'
                        : '#dc2626'
                      : c.surfaceMuted,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Eliminar cuenta permanentemente"
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={[styles.dangerBtnText, { color: canConfirm ? '#ffffff' : c.textSubtle }]}>
                    Eliminar cuenta permanentemente
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={onDismiss}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { borderColor: c.border, opacity: submitting ? 0.4 : pressed ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
              >
                <Text style={[styles.cancelText, { color: c.text }]}>Cancelar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kbd: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    paddingBottom: Spacing['2xl'],
    maxHeight: '92%',
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
    alignItems: 'stretch',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subheading: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  bold: { fontWeight: '700' },
  warnBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  warnTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  warnPhrase: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  input: {
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
  },
  actions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  dangerBtn: {
    height: 50,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    height: 46,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
