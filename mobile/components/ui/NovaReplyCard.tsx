import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { describeApplied, type AppliedItem } from '@/src/data/novaActions';

type Props = {
  // Texto que devolvió Nova en el campo `message`.
  reply: string;
  // Acciones ya aplicadas localmente (para chips).
  applied: AppliedItem[];
  // Si está loading (Nova procesando), mostramos un placeholder en vez del texto.
  loading?: boolean;
  // Mensaje de error humano (si hubo). Si viene, se muestra en rojo y se
  // omiten chips.
  error?: string | null;
  // Callbacks
  onUndo?: () => void;
  onDismiss: () => void;
};

// Réplica de la "burbuja de reply" del legacy FocusBar.jsx (líneas 789-854).
// Inline, dentro de Mi Día, justo bajo el FocusBar que disparó el mensaje.
//
// Layout:
//   ┌───────────────────────────────────────────────────────────┐
//   │ [✦] Listo, agendé "Llamar a Jacob" hoy a las 5pm.   [×]   │
//   │                                                            │
//   │ [Agregado: Llamar a Jacob]   [Tarea: Comprar pan]          │
//   │                                                            │
//   │              [↺ Deshacer]                                  │
//   └───────────────────────────────────────────────────────────┘
//
// Visual match legacy:
//   rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 shadow-sm
//   icon h-8 w-8 rounded-full bg-primary/10 text-primary
//   chips rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium
//   undo rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-bold text-white
export function NovaReplyCard({
  reply,
  applied,
  loading = false,
  error = null,
  onUndo,
  onDismiss,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const undoable =
    applied.some((a) => a.kind === 'event_created' || a.kind === 'task_created' || a.kind === 'task_toggled');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: error ? c.surfaceMuted : c.surfaceTint,
          borderColor: error ? c.danger : c.border,
        },
      ]}
    >
      {/* Header: icono sparkles + reply text + close */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: error ? '#fee2e2' : c.surface, borderColor: c.border },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : (
            <IconSymbol
              name="sparkles"
              size={16}
              color={error ? c.danger : c.primary}
            />
          )}
        </View>
        <Text
          style={[
            styles.replyText,
            { color: error ? c.danger : c.text },
          ]}
          selectable
        >
          {loading ? 'Nova está pensando…' : error ?? reply}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={styles.closeBtn}
        >
          <IconSymbol name="xmark" size={14} color={c.textSubtle} />
        </Pressable>
      </View>

      {/* Chips: una por cada action aplicada */}
      {!loading && !error && applied.length > 0 ? (
        <View style={styles.chipsRow}>
          {applied.map((item, idx) => (
            <View
              key={`${item.kind}-${idx}`}
              style={[
                styles.chip,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <IconSymbol name="sparkles" size={11} color={c.primary} />
              <Text style={[styles.chipText, { color: c.primary }]}>
                {describeApplied(item)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer: botón Deshacer si hay algo undoable */}
      {!loading && !error && undoable && onUndo ? (
        <View style={styles.footer}>
          <Pressable
            onPress={onUndo}
            style={({ pressed }) => [
              styles.undoBtn,
              {
                backgroundColor: c.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Deshacer"
          >
            <Text style={[styles.undoText, { color: c.onPrimary }]}>Deshacer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  replyText: {
    flex: 1,
    ...Typography.body,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  undoText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
