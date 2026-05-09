import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Llamado al tocar una sugerencia; el padre debe sembrar el FocusBar con `text`.
  onPickPrompt: (text: string) => void;
  // Insight humano calculado en backend (/api/today-context). Si está,
  // reemplaza el insight estático local. Mejor data > heurística cliente.
  summaryOverride?: string | null;
  // Tip operativo del clima cruzado con calendario (ej. "Lluvia hoy 70%,
  // adelanta tu salida"). Se renderiza como segunda línea pequeña.
  weatherTip?: string | null;
};

type Suggestion = { icon: 'sparkles' | 'calendar' | 'checklist'; title: string; prompt: string };

// Tiempo de calidad disponible — descontamos buffers para que la cifra sea
// "horas de ejecución real", no tiempo picado. Si el usuario está despierto
// hasta ~23:30, esto da un número honesto sobre cuánto puede aún producir.
function freeHoursUntilEvening(): number {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 0, 0, 0); // corte de jornada útil
  const ms = endOfDay.getTime() - now.getTime();
  if (ms <= 0) return 0;
  // Restamos 30min de "buffer mental" por hora — Deep Work ≠ tiempo bruto.
  const rawHours = ms / (1000 * 60 * 60);
  const qualityHours = Math.max(0, rawHours - 0.5);
  return Math.round(qualityHours * 2) / 2; // medio en medio
}

function timeContext(): { headline: string; insight: string; suggestions: Suggestion[] } {
  const hour = new Date().getHours();
  const free = freeHoursUntilEvening();

  if (hour < 12) {
    return {
      headline: 'Día limpio',
      insight: free > 1
        ? `Tienes ${free}h de margen útil. Buen momento para arrancar con algo importante.`
        : 'Buen momento para empezar con algo importante.',
      suggestions: [
        { icon: 'sparkles', title: 'Planifica el día', prompt: 'Planifica mi día' },
        { icon: 'checklist', title: 'Reserva 2 horas enfocadas', prompt: 'Reserva 2h enfocadas esta mañana' },
        { icon: 'calendar', title: 'Agenda algo para mañana', prompt: 'Agenda gym mañana a las 7' },
      ],
    };
  }
  if (hour < 18) {
    return {
      headline: 'Tarde abierta',
      insight: free > 1
        ? `Quedan ${free}h útiles. Buen momento para enfocar o adelantar pendientes.`
        : 'Buen momento para enfocar o adelantar pendientes.',
      suggestions: [
        { icon: 'checklist', title: 'Reserva 2 horas enfocadas', prompt: 'Reserva 2h enfocadas esta tarde' },
        { icon: 'sparkles', title: 'Organiza la próxima semana', prompt: 'Organiza la próxima semana' },
        { icon: 'calendar', title: 'Agenda algo para mañana', prompt: 'Agenda gym mañana a las 7' },
      ],
    };
  }
  return {
    headline: 'Casi cierre',
    insight: 'Sin pendientes urgentes. Mañana lo planeamos juntos.',
    suggestions: [
      { icon: 'calendar', title: 'Planifica mañana', prompt: 'Qué hago mañana' },
      { icon: 'sparkles', title: 'Recordatorio para mañana', prompt: 'Recordatorio para mañana a las 9' },
      { icon: 'checklist', title: 'Organiza la próxima semana', prompt: 'Organiza la próxima semana' },
    ],
  };
}

// Empty state proactivo — Resumen ejecutivo + 3 sugerencias por hora.
// Glassmorphism real con expo-blur en la card de Resumen para que se sienta
// como una capa orgánica sobre el sistema, no como un panel plano.
export function EmptyDayState({ onPickPrompt, summaryOverride, weatherTip }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const ctx = timeContext();
  const isDark = scheme === 'dark';
  const insight = summaryOverride ?? ctx.insight;

  return (
    <View style={styles.wrap}>
      {/* Resumen ejecutivo: BlurView con tinte sistema → translúcido sobre
          el ambient gradient de la pantalla. Si el OS no soporta blur, cae
          a backgroundColor sólido del estilo absoluto. */}
      <View style={styles.summaryShadow}>
        <BlurView
          intensity={isDark ? 35 : 50}
          tint={isDark ? 'dark' : 'light'}
          style={styles.summaryCard}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(139,92,246,0.18)', 'rgba(59,130,246,0.08)', 'rgba(34,211,238,0.03)']
                : ['rgba(139,92,246,0.10)', 'rgba(59,130,246,0.04)', 'rgba(34,211,238,0.01)']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={[styles.summaryBorder, { borderColor: c.border }]} pointerEvents="none" />
          <View style={styles.summaryHeader}>
            <View style={[styles.summaryDot, { backgroundColor: '#8b5cf6' }]} />
            <Text style={[styles.summaryLabel, { color: c.textMuted }]}>RESUMEN</Text>
          </View>
          <Text style={[styles.summaryTitle, { color: c.text }]}>{ctx.headline}</Text>
          <Text style={[styles.summaryInsight, { color: c.textMuted }]}>{insight}</Text>
          {weatherTip ? (
            <View style={styles.weatherRow}>
              <View style={[styles.weatherDot, { backgroundColor: '#22d3ee' }]} />
              <Text style={[styles.weatherText, { color: c.textMuted }]} numberOfLines={2}>
                {weatherTip}
              </Text>
            </View>
          ) : null}
        </BlurView>
      </View>

      {/* Sugerencias proactivas — primera con gradiente Gemini, las otras
          glass neutro. Borde fino tipo glass. */}
      <View style={styles.suggestionsCol}>
        {ctx.suggestions.map((s, i) => (
          <Pressable
            key={s.prompt}
            onPress={() => onPickPrompt(s.prompt)}
            style={({ pressed }) => [
              styles.suggestionShadow,
              {
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={s.title}
          >
            <BlurView
              intensity={isDark ? 25 : 40}
              tint={isDark ? 'dark' : 'light'}
              style={styles.suggestion}
            >
              <View style={[styles.suggestionBorder, { borderColor: c.border }]} pointerEvents="none" />
              {i === 0 ? (
                <LinearGradient
                  colors={['#22d3ee', '#3b82f6', '#8b5cf6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.suggestionIcon}
                >
                  <IconSymbol name={s.icon} size={14} color="#ffffff" />
                </LinearGradient>
              ) : (
                <View style={[styles.suggestionIconMuted, { backgroundColor: c.primaryContainer }]}>
                  <IconSymbol name={s.icon} size={14} color={c.primary} />
                </View>
              )}
              <Text style={[styles.suggestionTitle, { color: c.text }]} numberOfLines={1}>
                {s.title}
              </Text>
              <IconSymbol name="chevron.right" size={13} color={c.textSubtle} />
            </BlurView>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  summaryShadow: {
    borderRadius: 18,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 4,
  },
  summaryCard: {
    overflow: 'hidden',
    borderRadius: 18,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 14,
    gap: 4,
  },
  summaryBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderRadius: 18,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  summaryInsight: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '400',
    marginTop: 2,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  weatherDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  weatherText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  suggestionsCol: {
    gap: 8,
  },
  suggestionShadow: {
    borderRadius: 14,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestion: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 0.5,
    borderRadius: 14,
  },
  suggestionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIconMuted: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    flex: 1,
  },
});
