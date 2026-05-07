import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isToday } from '@/src/data/today';
import type { EventItem } from '@/src/data/types';

type Props = {
  dateISO: string;
  events: EventItem[];          // ya filtrados al día seleccionado
  pendingTasksCount: number;    // tareas con done=false (globales — no hay fecha en Task)
  onAskNova: () => void;
};

// Devuelve "HH:MM" o null si el evento no tiene hora ("todo el día").
function startOf(event: EventItem): string | null {
  if (!event.time) return null;
  const m = event.time.replace(/\s/g, '').match(/^(\d{1,2}:\d{2})/);
  return m ? m[1] : null;
}

// Genera el texto de resumen 100% client-side a partir de datos reales.
// Sin llamadas a Nova (eso vendría en V2). Reglas:
// · 0 eventos + 0 tareas → "Día libre"
// · 0 eventos + N tareas → "Sin eventos. N tareas pendientes."
// · N eventos             → cuenta + primer evento + bloque "todo el día" si hay
function buildSummary({
  events,
  pendingTasksCount,
  isCurrentDay,
}: {
  events: EventItem[];
  pendingTasksCount: number;
  isCurrentDay: boolean;
}): { headline: string; detail: string } {
  const total = events.length;
  const allDay = events.filter((e) => !e.time);
  const timed = events.filter((e) => !!e.time);

  if (total === 0 && pendingTasksCount === 0) {
    return {
      headline: isCurrentDay ? 'Día libre.' : 'Sin eventos.',
      detail: isCurrentDay
        ? 'Aprovecha para enfocarte en lo que más importa.'
        : 'Todavía no tienes nada agendado para este día.',
    };
  }

  if (total === 0) {
    return {
      headline: `${pendingTasksCount} ${pendingTasksCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}.`,
      detail: 'Sin eventos en la agenda. Ideal para avanzar.',
    };
  }

  // Hay al menos 1 evento.
  const eventsWord = total === 1 ? 'evento' : 'eventos';
  const tasksFragment =
    pendingTasksCount > 0
      ? ` · ${pendingTasksCount} ${pendingTasksCount === 1 ? 'tarea' : 'tareas'}`
      : '';
  const headline = `${total} ${eventsWord}${tasksFragment}.`;

  let detail = '';
  if (timed.length > 0) {
    const first = timed[0];
    const t = startOf(first);
    if (t) {
      detail = `Empiezas con "${first.title}" a las ${t}.`;
    } else {
      detail = `El primero: "${first.title}".`;
    }
  } else if (allDay.length > 0) {
    detail = allDay.length === 1
      ? `Tienes "${allDay[0].title}" para todo el día.`
      : `${allDay.length} bloques sin hora definida.`;
  }

  if (allDay.length > 0 && timed.length > 0) {
    detail += ` Hay ${allDay.length} ${allDay.length === 1 ? 'bloque' : 'bloques'} sin hora.`;
  }

  return { headline, detail };
}

export function SmartDaySummary({ dateISO, events, pendingTasksCount, onAskNova }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const isCurrentDay = isToday(dateISO);
  const summary = useMemo(
    () => buildSummary({ events, pendingTasksCount, isCurrentDay }),
    [events, pendingTasksCount, isCurrentDay],
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surfaceTint, borderColor: c.border },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <IconSymbol name="sparkles" size={18} color={c.primary} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: c.primary }]}>
            {isCurrentDay ? 'Resumen de hoy' : 'Resumen del día'}
          </Text>
          <Text style={[styles.headline, { color: c.text }]} numberOfLines={2}>
            {summary.headline}
          </Text>
          {summary.detail ? (
            <Text style={[styles.detail, { color: c.textMuted }]} numberOfLines={3}>
              {summary.detail}
            </Text>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={onAskNova}
        style={({ pressed }) => [
          styles.cta,
          { borderTopColor: c.border, opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Pídele más a Nova"
      >
        <Text style={[styles.ctaText, { color: c.primary }]}>Pídele más a Nova</Text>
        <IconSymbol name="chevron.right" size={16} color={c.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  eyebrow: {
    ...Typography.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    ...Typography.title3,
    fontSize: 16,
    lineHeight: 22,
  },
  detail: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaText: {
    ...Typography.bodyStrong,
    fontSize: 13,
  },
});
