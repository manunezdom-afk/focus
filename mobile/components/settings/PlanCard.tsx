import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { UsageActionInfo, UserPlanInfo } from '@/src/data/userPlan';

type Props = {
  data: UserPlanInfo | null;
  loading: boolean;
};

const NOVA_MESSAGE = 'nova_message';
const NOVA_SMART_ACTION = 'nova_smart_action';
const PHOTO_ANALYSIS = 'photo_analysis';

// Etiquetas humanas para cada action_type. Coinciden con messageForLimit
// del server (api/_lib/usageLimits.js) para que la UI coincida con los
// mensajes que ve el usuario cuando le bloquean una acción.
const ACTION_LABELS: Record<string, string> = {
  [NOVA_MESSAGE]:      'Mensajes con Nova',
  [NOVA_SMART_ACTION]: 'Acciones inteligentes',
  organize_day:        'Organizar día',
  weekly_planning:     'Planificación semanal',
  voice_ai:            'Voz con IA',
  [PHOTO_ANALYSIS]:    'Análisis de fotos',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free:         'Plan gratuito · cuotas diarias conservadoras',
  early_access: 'Programa beta · cuotas ampliadas durante el cohort',
  plus:         'Plan Plus · cuotas amplias',
  pro:          'Plan Pro · cuotas amplias',
  admin:        'Acceso admin · sin restricciones prácticas',
};

function formatResetAt(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs <= 0) return 'pronto';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `en ${days} d`;
    }
    if (hours >= 1) return `en ${hours}h ${mins}m`;
    return `en ${mins}m`;
  } catch {
    return 'pronto';
  }
}

// Render una barra horizontal con used/limit. Verde (ok), ámbar (75%+),
// rojo (95%+).
function UsageBar({ used, limit, scheme }: { used: number; limit: number; scheme: 'light' | 'dark' }) {
  const c = Colors[scheme];
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 95 ? '#dc2626' : pct >= 75 ? '#d97706' : c.primary;
  return (
    <View style={[styles.barTrack, { backgroundColor: c.surfaceMuted }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function ActionRow({
  actionType,
  info,
  scheme,
}: {
  actionType: string;
  info: UsageActionInfo;
  scheme: 'light' | 'dark';
}) {
  const c = Colors[scheme];
  const label = ACTION_LABELS[actionType] ?? actionType;
  // Periods puede tener más de uno (daily + weekly). Mostramos el más
  // restrictivo (mayor used/limit ratio). Si no hay periodo válido,
  // skipeamos la fila — no inventamos números.
  const period = info.periods?.[0];
  if (!period) return null;
  const resetLabel = formatResetAt(period.resetAt);
  const periodLabel = period.name === 'weekly' ? 'esta semana' : period.name === 'monthly' ? 'este mes' : 'hoy';
  return (
    <View style={styles.actionRow}>
      <View style={styles.actionHeader}>
        <Text style={[styles.actionLabel, { color: c.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.actionCount, { color: c.textMuted }]}>
          {period.used} / {period.limit} · {periodLabel}
        </Text>
      </View>
      <UsageBar used={period.used} limit={period.limit} scheme={scheme} />
      <Text style={[styles.resetText, { color: c.textSubtle }]}>Se reinicia {resetLabel}</Text>
    </View>
  );
}

// Card del plan dentro de Ajustes. Muestra:
//   * Badge con el nombre humano del plan ("Free" / "Early Access" / etc).
//   * Descripción corta del plan.
//   * Por cada action_type con cuota: barra de uso + reset_at.
export function PlanCard({ data, loading }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  if (loading && !data) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <ActivityIndicator color={c.primary} size="small" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.errorText, { color: c.textMuted }]}>
          No pudimos cargar tu plan. Intenta más tarde.
        </Text>
      </View>
    );
  }

  // Orden estable: priorizamos las acciones que el usuario más toca
  // (mensajes/acciones de Nova) y luego el resto. Ignora acciones sin
  // periodos (no se muestran).
  const orderedActionTypes = [
    NOVA_MESSAGE,
    NOVA_SMART_ACTION,
    PHOTO_ANALYSIS,
    'organize_day',
    'weekly_planning',
    'voice_ai',
  ].filter((t) => data.usage[t]?.periods?.length);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.badge, { backgroundColor: c.primary }]}>
            <IconSymbol name="sparkles" size={11} color={c.onPrimary} />
            <Text style={[styles.badgeText, { color: c.onPrimary }]}>{data.planLabel}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.description, { color: c.textMuted }]}>
        {PLAN_DESCRIPTIONS[data.plan] ?? 'Plan activo'}
      </Text>

      {orderedActionTypes.length > 0 ? (
        <View style={styles.actionsList}>
          {orderedActionTypes.map((actionType) => (
            <ActionRow
              key={actionType}
              actionType={actionType}
              info={data.usage[actionType]!}
              scheme={scheme}
            />
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyText, { color: c.textSubtle }]}>
          Sin uso registrado todavía. Cuando empieces a chatear con Nova,
          aparecerá tu progreso acá.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsList: {
    gap: Spacing.md - 2,
    marginTop: Spacing.xs,
  },
  actionRow: {
    gap: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  actionLabel: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  resetText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
