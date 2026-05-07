import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendOtp } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Step = 'email' | 'code';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function humanizeError(key: string | null): string | null {
    if (!key) return null;
    switch (key) {
      case 'invalid_email':
        return 'Ese correo no parece válido.';
      case 'rate_limited':
        return 'Demasiados intentos. Espera un minuto y prueba de nuevo.';
      case 'email_not_configured':
      case 'no_backend_supabase':
        return 'El servicio de correo no está disponible ahora.';
      case 'email_send_failed':
        return 'No pudimos enviar el código. Verifica tu correo y reintenta.';
      case 'invalid_code':
        return 'Código incorrecto o vencido. Pide uno nuevo.';
      case 'no_supabase':
        return 'La app no está configurada. Avisa a soporte.';
      default:
        return 'Algo salió mal. Intenta de nuevo en un momento.';
    }
  }

  async function handleSendOtp() {
    if (loading) return;
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setError('invalid_email');
      return;
    }
    if (!supabase) {
      setError('no_supabase');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await sendOtp(value);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setEmail(value);
    setStep('code');
  }

  async function handleVerifyOtp() {
    if (loading) return;
    const token = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(token)) {
      setError('invalid_code');
      return;
    }
    if (!supabase) {
      setError('no_supabase');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    setLoading(false);
    if (verifyErr) {
      setError('invalid_code');
      return;
    }
    // onAuthStateChange en AuthProvider toma la posta y AuthGate redirige
    // a (tabs).
  }

  function handleBackToEmail() {
    setStep('email');
    setCode('');
    setError(null);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.brand, { color: c.textMuted }]}>Focus</Text>
            <Text style={[styles.title, { color: c.text }]}>
              {step === 'email' ? 'Inicia sesión' : 'Revisa tu correo'}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {step === 'email'
                ? 'Te enviaremos un código de 6 dígitos a tu correo.'
                : `Enviamos un código a ${email}. Pégalo o escríbelo abajo.`}
            </Text>
          </View>

          {step === 'email' ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
              placeholder="tu@correo.com"
              placeholderTextColor={c.textMuted}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              inputMode="email"
              returnKeyType="go"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSendOtp}
              editable={!loading}
            />
          ) : (
            <TextInput
              style={[
                styles.input,
                styles.code,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
              placeholder="123456"
              placeholderTextColor={c.textMuted}
              autoComplete="one-time-code"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              returnKeyType="go"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              onSubmitEditing={handleVerifyOtp}
              editable={!loading}
            />
          )}

          {error ? (
            <Text style={[styles.error, { color: c.danger }]}>{humanizeError(error)}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={step === 'email' ? handleSendOtp : handleVerifyOtp}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: c.text,
                opacity: loading ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={c.background} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: c.background }]}>
                {step === 'email' ? 'Enviar código' : 'Entrar'}
              </Text>
            )}
          </Pressable>

          {step === 'code' ? (
            <Pressable
              onPress={handleBackToEmail}
              disabled={loading}
              style={styles.secondaryButton}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryButtonText, { color: c.textMuted }]}>
                Cambiar correo
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
  },
  header: {
    gap: 8,
    marginBottom: 16,
  },
  brand: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 17,
  },
  code: {
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    letterSpacing: 12,
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
