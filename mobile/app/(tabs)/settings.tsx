import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeNavigator } from '@/components/navigation/SwipeNavigator';
import { DeleteAccountSheet } from '@/components/settings/DeleteAccountSheet';
import { MemoriesSheet } from '@/components/settings/MemoriesSheet';
import { PersonalitySheet } from '@/components/settings/PersonalitySheet';
import { PlanCard } from '@/components/settings/PlanCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SettingsRow, SettingsSection } from '@/components/ui/SettingsList';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/src/auth/AuthProvider';
import { useMemories } from '@/src/data/useMemories';
import { useUserPlan } from '@/src/data/useUserPlan';
import { useUserProfile } from '@/src/data/useUserProfile';

// Etiqueta del esquema de color actual del sistema (no preference real
// todavía — Expo sigue al sistema). Si en el futuro existe preferencia
// persistida (light/dark/system), cambiar este helper para leerla.
function appearanceLabel(scheme: 'light' | 'dark'): string {
  return scheme === 'dark' ? 'Siguiendo el sistema · Oscuro' : 'Siguiendo el sistema · Claro';
}

function personalitySubLabel(p?: 'focus' | 'cercana' | 'estrategica' | null): string {
  switch (p) {
    case 'cercana':
      return 'Tono cercano · cálido';
    case 'estrategica':
      return 'Tono estratégico · con razón';
    case 'focus':
      return 'Tono enfocado · directo';
    default:
      return 'Tono enfocado · directo';
  }
}

function memoriesSubLabel(count: number, loading: boolean): string {
  if (loading && count === 0) return 'Cargando…';
  if (count === 0) return 'Sin memorias guardadas';
  if (count === 1) return '1 memoria guardada';
  return `${count} memorias guardadas`;
}

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { user, signOut } = useAuth();
  const profile = useUserProfile();
  const memoriesHook = useMemories();
  const userPlan = useUserPlan();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);

  const isAuthenticated = !!user;
  const email = user?.email ?? null;
  const initial = ((email?.[0] || 'F') as string).toUpperCase();

  function confirmSignOut() {
    if (loggingOut) return;
    Alert.alert(
      '¿Cerrar sesión?',
      'Tendrás que volver a iniciar sesión para usar Focus. Tus datos en la nube se mantienen.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            if (Platform.OS === 'ios') {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            try {
              await signOut();
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  }

  function comingSoon(feature: string, hint?: string) {
    Alert.alert(
      feature,
      hint ?? 'Esta función estará disponible en la próxima versión.',
      [{ text: 'Entendido', style: 'default' }],
    );
  }

  // Doble cinturón para borrar cuenta:
  //   1) Alert de bienvenida con copy fuerte de App Store-grade.
  //   2) Si el usuario continúa, abrimos DeleteAccountSheet que requiere
  //      tipear "ELIMINAR" para activar el botón rojo.
  // Si la API responde OK, corremos signOut local — AuthGate detecta
  // session=null y redirige a /(auth)/login automáticamente.
  function startDeleteFlow() {
    if (!isAuthenticated) return;
    if (Platform.OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert(
      'Eliminar cuenta',
      'Vas a eliminar de forma permanente tu cuenta y todos tus datos: eventos, tareas, memorias de Nova, uso de IA y configuración. No se pueden recuperar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => setShowDeleteAccount(true),
        },
      ],
      { cancelable: true },
    );
  }

  function openMirror() {
    if (Platform.OS === 'ios') {
      void Haptics.selectionAsync();
    }
    router.push('/(dev)/mirror');
  }

  const version = Application.nativeApplicationVersion ?? '0.1.0';
  const build = Application.nativeBuildVersion ?? '—';
  const appName = Application.applicationName ?? 'Focus';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Hero halo — patrón compartido con Mi Día / Calendar / Nova / Tareas. */}
      <View style={styles.heroHaloLayer} pointerEvents="none">
        <View
          style={[
            styles.heroHaloCircle,
            { backgroundColor: c.primaryContainer, opacity: scheme === 'dark' ? 0.45 : 0.55 },
          ]}
        />
        <View
          style={[
            styles.heroHaloCircleSoft,
            { backgroundColor: c.primaryContainer, opacity: scheme === 'dark' ? 0.18 : 0.22 },
          ]}
        />
      </View>

      <SwipeNavigator currentTab="settings">
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header premium — título 40px + subtítulo humano */}
        <Animated.View entering={FadeInDown.duration(360)} style={styles.header}>
          <Text style={[styles.titleLine, { color: c.text }]}>Ajustes</Text>
          <Text style={[styles.subLine, { color: c.textMuted }]} numberOfLines={1}>
            Administra tu cuenta y preferencias.
          </Text>
        </Animated.View>

        <View style={styles.body}>
          {/* AccountCard — avatar circular con inicial del email + status real */}
          <Animated.View entering={FadeInDown.delay(60).duration(360)}>
            <View
              style={[
                styles.accountCard,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: c.primary }]}>
                <Text style={[styles.avatarText, { color: c.onPrimary }]}>{initial}</Text>
              </View>
              <View style={styles.accountText}>
                <Text style={[styles.accountTitle, { color: c.text }]} numberOfLines={1}>
                  {email ?? 'Sin sesión'}
                </Text>
                <View style={styles.accountStatusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isAuthenticated ? c.success : c.warning },
                    ]}
                  />
                  <Text style={[styles.accountStatus, { color: c.textMuted }]}>
                    {isAuthenticated
                      ? 'Sesión activa · datos en la nube'
                      : 'Sin cuenta — inicia sesión'}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* ── Plan ─────────────────────────────────────────────────────
              Card con badge real del plan (Free/Early Access/Admin/etc),
              descripción honesta y barras de uso de IA con reset_at por
              acción. Datos vienen de /api/me/plan; con red caída renderiza
              fallback "Free" sin números (no inventamos). Sin SettingsSection
              wrapper para no anidar card-en-card; usamos un title propio
              para que la jerarquía visual coincida con el resto de secciones. */}
          {isAuthenticated ? (
            <Animated.View entering={FadeInDown.delay(90).duration(360)} style={styles.planSection}>
              <Text style={[styles.planSectionTitle, { color: c.textSubtle }]}>PLAN</Text>
              <PlanCard data={userPlan.data} loading={userPlan.loading} />
            </Animated.View>
          ) : null}

          {/* ── Cuenta ───────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(120).duration(360)}>
            <SettingsSection title="Cuenta">
              <SettingsRow
                isFirst
                iconName="gearshape.fill"
                label={isAuthenticated ? 'Email de la cuenta' : 'Sin sesión'}
                sub={email ?? 'Inicia sesión para sincronizar'}
              />
              <SettingsRow
                iconName="xmark"
                label={loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
                sub="Vuelve a iniciar sesión cuando quieras"
                danger
                onPress={isAuthenticated ? confirmSignOut : undefined}
              />
              <SettingsRow
                iconName="trash.fill"
                label="Eliminar cuenta"
                sub="Borrar de forma permanente la cuenta y todos los datos"
                danger
                onPress={isAuthenticated ? startDeleteFlow : undefined}
              />
            </SettingsSection>
          </Animated.View>

          {/* ── Nova ─────────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(180).duration(360)}>
            <SettingsSection title="Nova">
              <SettingsRow
                isFirst
                iconName="sparkles"
                label="Personalidad de Nova"
                sub={personalitySubLabel(profile.profile?.novaPersonality)}
                onPress={() => {
                  if (Platform.OS === 'ios') void Haptics.selectionAsync();
                  setShowPersonality(true);
                }}
              />
              <SettingsRow
                iconName="sparkles"
                label="Memorias de Nova"
                sub={memoriesSubLabel(memoriesHook.memories.length, memoriesHook.loading)}
                onPress={() => {
                  if (Platform.OS === 'ios') void Haptics.selectionAsync();
                  setShowMemories(true);
                }}
              />
            </SettingsSection>
          </Animated.View>

          {/* ── Notificaciones ───────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(240).duration(360)}>
            <SettingsSection title="Notificaciones">
              <SettingsRow
                isFirst
                iconName="sparkles"
                label="Recordatorios inteligentes"
                sub="Próximamente · pediremos permiso al activar"
                onPress={() =>
                  comingSoon(
                    'Recordatorios',
                    'Nova te avisará antes de cada bloque importante. Te pediremos permiso de notificaciones cuando lo actives.',
                  )
                }
              />
              <SettingsRow
                iconName="sparkles"
                label="Horario silencioso"
                sub="Sin alertas en horas marcadas (próximamente)"
                onPress={() => comingSoon('Horario silencioso')}
              />
            </SettingsSection>
          </Animated.View>

          {/* ── Preferencias ─────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(300).duration(360)}>
            <SettingsSection title="Preferencias">
              <SettingsRow
                isFirst
                iconName="sun.max.fill"
                label="Apariencia"
                sub={appearanceLabel(scheme)}
              />
              <SettingsRow
                iconName="sparkles"
                label="Vibración táctil"
                sub="Habilitada en interacciones clave"
              />
            </SettingsSection>
          </Animated.View>

          {/* ── Privacidad y datos ───────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(360).duration(360)}>
            <SettingsSection title="Privacidad y datos">
              <SettingsRow
                isFirst
                iconName="checklist"
                label="Tus datos"
                sub="Exportar/importar (próximamente)"
                onPress={() =>
                  comingSoon(
                    'Tus datos',
                    'Podrás exportar tus eventos y tareas como .ics y .json. Próximamente.',
                  )
                }
              />
              <SettingsRow
                iconName="gearshape.fill"
                label="Privacidad"
                sub="Tus datos viven solo en tu cuenta. RLS por usuario."
              />
            </SettingsSection>
          </Animated.View>

          {/* ── Desarrollo (solo __DEV__) ────────────────────────────── */}
          {__DEV__ ? (
            <Animated.View entering={FadeInDown.delay(420).duration(360)}>
              <SettingsSection title="Desarrollo">
                <SettingsRow
                  isFirst
                  iconName="sparkles"
                  label="Migration Mirror"
                  sub="Comparar con la app legacy en LAN"
                  onPress={openMirror}
                />
              </SettingsSection>
            </Animated.View>
          ) : null}

          {/* ── Aplicación ───────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(__DEV__ ? 480 : 420).duration(360)}>
            <SettingsSection title="Aplicación">
              <SettingsRow
                isFirst
                iconName="sparkles"
                label={appName}
                sub={`Versión ${version} (${build})`}
              />
            </SettingsSection>
          </Animated.View>

          {/* Footer pequeño con marca calmada */}
          <Animated.View
            entering={FadeInDown.delay(540).duration(420)}
            style={styles.footer}
          >
            <Text style={[styles.footerText, { color: c.textSubtle }]}>
              Focus · Productividad inteligente
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
      </SwipeNavigator>

      <PersonalitySheet
        visible={showPersonality}
        onDismiss={() => setShowPersonality(false)}
        selected={profile.profile?.novaPersonality ?? 'focus'}
        saving={profile.saving}
        onSelect={async (p) => {
          await profile.setNovaPersonality(p);
        }}
      />

      <MemoriesSheet
        visible={showMemories}
        onDismiss={() => setShowMemories(false)}
        memories={memoriesHook.memories}
        loading={memoriesHook.loading}
        onDelete={memoriesHook.removeMemory}
      />

      <DeleteAccountSheet
        visible={showDeleteAccount}
        onDismiss={() => setShowDeleteAccount(false)}
        onSuccess={async () => {
          // El endpoint ya invalidó el JWT en server. Cerramos sesión local
          // para que cacheRegistry limpie los Maps de useEvents/useTasks/etc
          // y AuthGate del root layout redirija a /(auth)/login.
          await signOut();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: Spacing['3xl'] + 60 },

  // Hero halo (mismos números que las otras pantallas principales)
  heroHaloLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    overflow: 'hidden',
  },
  heroHaloCircle: {
    position: 'absolute',
    top: -120,
    left: -60,
    right: -60,
    height: 320,
    borderBottomLeftRadius: 240,
    borderBottomRightRadius: 240,
  },
  heroHaloCircleSoft: {
    position: 'absolute',
    top: 60,
    left: -120,
    right: -120,
    height: 280,
    borderRadius: 240,
    transform: [{ scaleY: 0.55 }],
  },

  // Header premium
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 4,
  },
  titleLine: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  subLine: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },

  body: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },

  // Sección "Plan" — no usamos SettingsSection wrapper porque PlanCard ya
  // tiene su propio borde y meterla adentro generaría card-en-card. Mismo
  // tracking visual que las otras section titles para coherencia.
  planSection: {
    gap: Spacing.sm,
  },
  planSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.sm,
  },

  // AccountCard
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  accountText: {
    flex: 1,
    gap: 4,
  },
  accountTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  accountStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accountStatus: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    flex: 1,
  },

  footer: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
