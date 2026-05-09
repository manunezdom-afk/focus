import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  // Llamado al tocar una sugerencia; el padre debe sembrar el FocusBar con `text`.
  // Hasta que el usuario toque enviar, NO se crean datos — son solo prompts.
  onPickPrompt: (text: string) => void;
};

type Suggestion = { icon: 'sparkles' | 'calendar' | 'checklist'; title: string; prompt: string };

// Contexto por horario: Nova adapta lo que sugiere según la hora local.
// Mañana = arrancar fuerte. Tarde = enfocar. Noche = preparar mañana.
function timeContext(): { headline: string; insight: string; suggestions: Suggestion[] } {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      headline: 'Día limpio',
      insight: 'Decide cómo invertirlo. Buen momento para empezar con algo importante.',
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
      insight: 'Sin actividades agendadas. Buen momento para enfocar o adelantar pendientes.',
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

// Empty state proactivo — sin orbes ni hero centrado. Llena el espacio con
// valor real: un resumen del día y 3 sugerencias contextuales según hora.
// La identidad de Nova vive en el input bar y la tab bar, no acá.
export function EmptyDayState({ onPickPrompt }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const ctx = timeContext();
  const isDark = scheme === 'dark';

  return (
    <View style={styles.wrap}>
      {/* Resumen ejecutivo: contexto del día sin animaciones agresivas.
          Capa de gradiente sutil violeta→azul→cyan como ambiente Nova. */}
      <View style={[styles.summaryCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <LinearGradient
          colors={
            isDark
              ? ['rgba(139,92,246,0.10)', 'rgba(59,130,246,0.05)', 'rgba(34,211,238,0.02)']
              : ['rgba(139,92,246,0.07)', 'rgba(59,130,246,0.03)', 'rgba(34,211,238,0.01)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryDot, { backgroundColor: '#8b5cf6' }]} />
          <Text style={[styles.summaryLabel, { color: c.textMuted }]}>RESUMEN</Text>
        </View>
        <Text style={[styles.summaryTitle, { color: c.text }]}>{ctx.headline}</Text>
        <Text style={[styles.summaryInsight, { color: c.textMuted }]}>{ctx.insight}</Text>
      </View>

      {/* Sugerencias proactivas — primera con gradiente de marca, las otras
          neutras para no competir entre sí. Borde fino tipo glass. */}
      <View style={styles.suggestionsCol}>
        {ctx.suggestions.map((s, i) => (
          <Pressable
            key={s.prompt}
            onPress={() => onPickPrompt(s.prompt)}
            style={({ pressed }) => [
              styles.suggestion,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={s.title}
          >
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
  summaryCard: {
    overflow: 'hidden',
    borderWidth: 0.5,
    borderRadius: 18,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 14,
    gap: 4,
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
  suggestionsCol: {
    gap: 8,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 0.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
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
