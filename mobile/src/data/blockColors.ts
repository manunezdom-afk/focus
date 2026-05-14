// Sistema de color por tipo de bloque para el timeline (Mi Día, Calendario).
// Cada tipo tiene su acento propio para que el ojo distinga rápido qué es
// qué, sin tener que leer el título.
//
// Reglas de detección:
//   - 'reminder' si el título empieza con "Recordatorio:" (convención legacy
//     usada en system prompt de Nova).
//   - 'focus' si event.section === 'focus' y NO es recordatorio (bloques de
//     trabajo enfocado tienen su tono cyan).
//   - 'event' es el default para cualquier otro evento.
//   - 'task' lo asigna directo TimelineTaskBlock.

export type BlockKind = 'event' | 'reminder' | 'task' | 'focus';

export type BlockColorSet = {
  accent: string; // borde lateral / dot del timeline
  badge: string; // background del chip de etiqueta
  badgeText: string; // color del chip de etiqueta
  label: string; // texto del chip
};

export function isReminderTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return /^\s*recordatorio\s*:/i.test(title);
}

export function detectEventKind(opts: {
  title: string;
  section?: string | null;
  icon?: string | null;
}): BlockKind {
  if (isReminderTitle(opts.title)) return 'reminder';
  if (opts.section === 'reminder' || opts.icon === 'alarm') return 'reminder';
  if (opts.section === 'focus') return 'focus';
  return 'event';
}

// Colores por tipo y por modo claro/oscuro. Usamos hex literal para que sean
// constantes y predecibles (no dependen de tokens del theme — el theme sigue
// siendo primary indigo, esto agrega categorías secundarias).
export function getBlockColors(
  kind: BlockKind,
  scheme: 'light' | 'dark',
): BlockColorSet {
  const dark = scheme === 'dark';
  switch (kind) {
    case 'reminder':
      return {
        accent: '#f59e0b',
        badge: dark ? '#3a2a0e' : '#fef3c7',
        badgeText: dark ? '#fbbf24' : '#b45309',
        label: 'Recordatorio',
      };
    case 'task':
      // Slate gray-azulado: distingue tareas de eventos (royal blue brillante)
      // sin recurrir al violeta. Da sensación de "neutro / a hacer".
      return {
        accent: dark ? '#94a3b8' : '#475569',
        badge: dark ? '#1e293b' : '#e2e8f0',
        badgeText: dark ? '#cbd5e1' : '#334155',
        label: 'Tarea',
      };
    case 'focus':
      return {
        accent: '#06b6d4',
        badge: dark ? '#0c3d4a' : '#cffafe',
        badgeText: dark ? '#67e8f9' : '#0e7490',
        label: 'Enfocado',
      };
    case 'event':
    default:
      return {
        accent: '#3b82f6',
        badge: dark ? '#1e2f4a' : '#dbeafe',
        badgeText: dark ? '#93c5fd' : '#1d4ed8',
        label: 'Evento',
      };
  }
}
