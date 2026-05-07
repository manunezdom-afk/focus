import * as Application from 'expo-application';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useAuth } from '@/src/auth/AuthProvider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

  const version = Application.nativeApplicationVersion ?? '0.1.0';
  const build = Application.nativeBuildVersion ?? '—';

  return (
    <Screen title="Ajustes" subtitle="Tu cuenta y la app." scroll>
      <View style={styles.body}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textMuted }]}>Cuenta</Text>
          <Text style={[styles.value, { color: c.text }]}>{user?.email ?? '—'}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.label, { color: c.textMuted }]}>Versión</Text>
          <Text style={[styles.value, { color: c.text }]}>
            {version} ({build})
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={confirmSignOut}
          disabled={loggingOut}
          style={({ pressed }) => [
            styles.dangerButton,
            {
              borderColor: c.danger,
              opacity: loggingOut ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.dangerText, { color: c.danger }]}>
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: { fontSize: 16, fontWeight: '500' },
  dangerButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: { fontSize: 15, fontWeight: '600' },
});
