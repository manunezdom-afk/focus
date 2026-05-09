import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NovaOrb } from '@/components/nova/NovaOrb';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { sendOtp } from '@/src/lib/api';
import { supabase } from '@/src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type Step = 'choice' | 'email' | 'code';

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function LoginScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const isDark = scheme === 'dark';

  const [step, setStep] = useState<Step>('choice');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState<null | 'email' | 'google' | 'guest' | 'verify'>(null);
  const [error, setError] = useState<string | null>(null);

  function humanizeError(key: string | null): string | null {
    if (!key) return null;
    switch (key) {
      case 'invalid_email': return 'Ese correo no parece válido.';
      case 'rate_limited': return 'Demasiados intentos. Espera un minuto y prueba de nuevo.';
      case 'email_not_configured':
      case 'no_backend_supabase': return 'El servicio de correo no está disponible ahora.';
      case 'email_send_failed': return 'No pudimos enviar el código. Verifica tu correo y reintenta.';
      case 'invalid_code': return 'Código incorrecto o vencido. Pide uno nuevo.';
      case 'no_supabase': return 'La app no está configurada. Avisa a soporte.';
      case 'google_failed': return 'No pude iniciar sesión con Google. Reintenta o usa correo.';
      case 'guest_failed': return 'No pude iniciar el modo invitado. Reintenta en un momento.';
      case 'guest_disabled': return 'El modo invitado está deshabilitado. Activa Anonymous Sign-In en Supabase.';
      default: return 'Algo salió mal. Intenta de nuevo en un momento.';
    }
  }

  async function handleSendOtp() {
    if (loading) return;
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value) || value.length > 254) { setError('invalid_email'); return; }
    if (!supabase) { setError('no_supabase'); return; }
    setLoading('email');
    setError(null);
    const result = await sendOtp(value);
    setLoading(null);
    if ('error' in result) { setError(result.error); return; }
    setEmail(value);
    setStep('code');
  }

  async function handleVerifyOtp() {
    if (loading) return;
    const token = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(token)) { setError('invalid_code'); return; }
    if (!supabase) { setError('no_supabase'); return; }
    setLoading('verify');
    setError(null);
    const { error: verifyErr } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setLoading(null);
    if (verifyErr) { setError('invalid_code'); return; }
  }

  async function handleGoogle() {
    if (loading) return;
    if (!supabase) { setError('no_supabase'); return; }
    setLoading('google');
    setError(null);
    try {
      const redirectTo = Linking.createURL('/login-callback');
      const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthErr || !data?.url) throw oauthErr ?? new Error('no_url');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        setLoading(null);
        return; // user cancelled
      }
      // Supabase redirige con #access_token=... en el hash
      const url = result.url;
      const hash = url.includes('#') ? url.split('#')[1] : '';
      const params = new URLSearchParams(hash || (url.includes('?') ? url.split('?')[1] : ''));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) throw new Error('no_tokens');
      const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (setErr) throw setErr;
    } catch {
      setError('google_failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleGuest() {
    if (loading) return;
    if (!supabase) { setError('no_supabase'); return; }
    setLoading('guest');
    setError(null);
    try {
      const { error: anonErr } = await (supabase.auth as any).signInAnonymously();
      if (anonErr) {
        const msg = String(anonErr?.message || '').toLowerCase();
        if (msg.includes('anonymous') || msg.includes('disabled')) {
          setError('guest_disabled');
          Alert.alert(
            'Modo invitado deshabilitado',
            'Para activarlo, ve a Supabase Dashboard → Authentication → Providers y enciende "Anonymous Sign-In".',
          );
        } else {
          setError('guest_failed');
        }
      }
    } catch {
      setError('guest_failed');
    } finally {
      setLoading(null);
    }
  }

  function handleBackToChoice() {
    setStep('choice');
    setCode('');
    setError(null);
  }

  function handleBackToEmail() {
    setStep('email');
    setCode('');
    setError(null);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      {/* Ambient gradient violeta sutil arriba — identidad Nova */}
      <LinearGradient
        colors={
          isDark
            ? ['rgba(139,92,246,0.20)', 'rgba(59,130,246,0.07)', 'rgba(139,92,246,0)']
            : ['rgba(139,92,246,0.12)', 'rgba(59,130,246,0.04)', 'rgba(139,92,246,0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={styles.ambient}
        pointerEvents="none"
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.heroOrb}>
              <NovaOrb size={48} ambient breathing />
            </View>
            <Text style={[styles.brand, { color: c.textMuted }]}>Focus</Text>
            <Text style={[styles.title, { color: c.text }]}>
              {step === 'code' ? 'Revisa tu correo' : step === 'email' ? 'Tu correo' : 'Bienvenido'}
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {step === 'code'
                ? `Enviamos un código a ${email}.`
                : step === 'email'
                ? 'Te enviaremos un código de 6 dígitos.'
                : 'Inicia sesión para que Nova organice tu día.'}
            </Text>
          </View>

          {step === 'choice' ? (
            <View style={styles.choiceCol}>
              <PrimaryGradientButton
                label="Continuar con correo"
                icon="paperplane.fill"
                onPress={() => setStep('email')}
                loading={false}
                disabled={!!loading}
              />
              <SecondaryButton
                label="Continuar con Google"
                onPress={handleGoogle}
                loading={loading === 'google'}
                disabled={!!loading && loading !== 'google'}
                c={c}
              />
              <Pressable
                onPress={handleGuest}
                disabled={!!loading}
                style={({ pressed }) => [styles.guestBtn, { opacity: pressed ? 0.6 : 1 }]}
                accessibilityRole="button"
              >
                {loading === 'guest' ? (
                  <ActivityIndicator color={c.textMuted} size="small" />
                ) : (
                  <Text style={[styles.guestText, { color: c.textMuted }]}>Probar como invitado</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {step === 'email' ? (
            <View style={styles.formCol}>
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
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
                autoFocus
              />
              <PrimaryGradientButton
                label="Enviar código"
                icon="arrow.up"
                onPress={handleSendOtp}
                loading={loading === 'email'}
                disabled={!!loading}
              />
              <Pressable onPress={handleBackToChoice} disabled={!!loading} style={styles.guestBtn}>
                <Text style={[styles.guestText, { color: c.textMuted }]}>Otra opción</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 'code' ? (
            <View style={styles.formCol}>
              <TextInput
                style={[styles.input, styles.code, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
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
                autoFocus
              />
              <PrimaryGradientButton
                label="Entrar"
                icon="arrow.up"
                onPress={handleVerifyOtp}
                loading={loading === 'verify'}
                disabled={!!loading}
              />
              <Pressable onPress={handleBackToEmail} disabled={!!loading} style={styles.guestBtn}>
                <Text style={[styles.guestText, { color: c.textMuted }]}>Cambiar correo</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={[styles.error, { color: c.danger }]}>{humanizeError(error)}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PrimaryGradientButton({
  label, icon, onPress, loading, disabled,
}: {
  label: string;
  icon: 'paperplane.fill' | 'arrow.up';
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient
        colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryBtn}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Text style={styles.primaryBtnText}>{label}</Text>
            <IconSymbol name={icon} size={16} color="#ffffff" />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function SecondaryButton({
  label, onPress, loading, disabled, c,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  c: typeof Colors.light;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.secondaryBtn,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={c.text} size="small" />
      ) : (
        <Text style={[styles.secondaryBtnText, { color: c.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 18 },
  header: { gap: 8, marginBottom: 16, alignItems: 'flex-start' },
  heroOrb: { marginBottom: 6 },
  brand: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 36, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  choiceCol: { gap: 10 },
  formCol: { gap: 10 },
  input: { borderWidth: 0.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, fontSize: 17 },
  code: { fontSize: 26, fontVariant: ['tabular-nums'], letterSpacing: 12, textAlign: 'center' },
  error: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '500' },
  guestBtn: { paddingVertical: 12, alignItems: 'center' },
  guestText: { fontSize: 14, fontWeight: '500' },
});
