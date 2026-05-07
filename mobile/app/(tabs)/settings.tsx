import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SettingsRow, SettingsSection } from '@/components/ui/SettingsList';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/src/auth/AuthProvider';

export default function SettingsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  function confirmSignOut() {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres cerrar sesión en este dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            if (loggingOut) return;
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

  function comingSoon(feature: string) {
    Alert.alert(
      feature,
      'Esta función estará disponible en la próxima versión.',
      [{ text: 'Entendido', style: 'default' }],
    );
  }

  const version = Application.nativeApplicationVersion ?? '0.1.0';
  const build = Application.nativeBuildVersion ?? '—';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Ajustes" subtitle="Tu cuenta y la app." />

        <View style={styles.body}>
          {/* Cuenta */}
          <SettingsSection title="Cuenta">
            <SettingsRow
              isFirst
              iconName="gearshape.fill"
              label={user?.email ?? 'Sin sesión'}
              sub="Sesión activa en este dispositivo"
            />
          </SettingsSection>

          {/* Nova personality (placeholder por ahora — backend ya lo soporta) */}
          <SettingsSection title="Nova">
            <SettingsRow
              isFirst
              iconName="sparkles"
              label="Personalidad de Nova"
              sub="Tono enfocado · Predeterminado"
              onPress={() => comingSoon('Personalidad de Nova')}
            />
            <SettingsRow
              iconName="sparkles"
              label="Notificaciones inteligentes"
              sub="Próximamente"
              onPress={() => comingSoon('Notificaciones')}
            />
          </SettingsSection>

          {/* App */}
          <SettingsSection title="Aplicación">
            <SettingsRow
              isFirst
              iconName="gearshape.fill"
              label="Versión"
              sub={`${version} (${build})`}
            />
          </SettingsSection>

          {/* Desarrollo — solo en __DEV__. En release builds no se renderiza
              el SettingsSection completo, así que el usuario nunca lo ve. */}
          {__DEV__ ? (
            <SettingsSection title="Desarrollo">
              <SettingsRow
                isFirst
                iconName="sparkles"
                label="Migration Mirror"
                sub="Comparar con la app legacy en LAN"
                onPress={() => router.push('/(dev)/mirror')}
              />
            </SettingsSection>
          ) : null}

          {/* Zona peligrosa */}
          <View style={styles.dangerWrap}>
            <PrimaryButton
              label={loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
              variant="danger"
              size="lg"
              onPress={confirmSignOut}
              loading={loggingOut}
              disabled={loggingOut}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: Spacing['3xl'] + 60 },
  body: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  dangerWrap: { marginTop: Spacing.md },
});
