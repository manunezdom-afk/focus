// Defensa server-side contra Nova editando/borrando eventos sin que el
// usuario lo haya pedido explícitamente. El system prompt ya tiene la
// regla en texto, pero los modelos a veces alucinan: ven un evento
// parecido viejo, deciden mover el actual, y rompen la agenda.
//
// Este módulo es la última línea: si la intención del usuario NO incluye
// un verbo de edición, cualquier action de tipo edit_event / update_event /
// delete_event que llegue, queda strippeada (logged + removida).
//
// Lista de verbos basada en la regla acordada con el usuario:
//   mueve, cambia, edita, modifica, reagenda, pásalo, corre, adelanta,
//   atrasa, borra, elimina, cancela, quita.
// También cuentan formas conjugadas comunes ("muevelo", "cambiame", etc).

const EDIT_VERB_PATTERNS = [
  /\bmuev[a-záéíóú]*\b/i,
  /\bmov[eé]r[a-záéíóú]*\b/i,
  /\bcambi[a-záéíóú]*\b/i,
  /\bedit[a-záéíóú]*\b/i,
  /\bmodific[a-záéíóú]*\b/i,
  /\breagend[a-záéíóú]*\b/i,
  /\bp[aá]sal[a-záéíóú]*\b/i,
  /\bcorr[ea-záéíóú]*\s+(?:lo|la|el|al|para|a las|a la|de|de\s+las|hasta|desde|m[aá]s)/i, // "corre las 3 a las 4", "corre el evento", evita "corre" verbo
  /\badelant[a-záéíóú]*\b/i,
  /\batras[a-záéíóú]*\b/i,
  /\bborr[a-záéíóú]*\b/i,
  /\belimin[a-záéíóú]*\b/i,
  /\bcancel[a-záéíóú]*\b/i,
  /\bquit[a-záéíóú]*\b/i,
  /\breagrup[a-záéíóú]*\b/i,
  /\bdesplaz[a-záéíóú]*\b/i,
  /\bdesagend[a-záéíóú]*\b/i,
];

const EDIT_ACTION_TYPES = new Set(['edit_event', 'update_event', 'delete_event']);

/**
 * Devuelve true si el mensaje del usuario contiene un verbo de edición
 * explícito. Caja blanca para depuración.
 */
export function hasExplicitEditIntent(userMessage) {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return false;
  const m = userMessage.trim();
  for (const re of EDIT_VERB_PATTERNS) {
    if (re.test(m)) return true;
  }
  return false;
}

/**
 * Filtra acciones edit/update/delete cuando el usuario no expresó intención
 * de edición. Devuelve { actions, stripped } — actions es la lista limpia,
 * stripped son las acciones que se quitaron (para loggear o agregar nota
 * al reply).
 */
export function filterCalendarEditActions(actions, userMessage) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { actions: actions ?? [], stripped: [] };
  }
  if (hasExplicitEditIntent(userMessage)) {
    // El usuario sí pidió editar. No filtramos nada.
    return { actions, stripped: [] };
  }
  const kept = [];
  const stripped = [];
  for (const a of actions) {
    if (a && typeof a === 'object' && EDIT_ACTION_TYPES.has(a.type)) {
      stripped.push(a);
    } else {
      kept.push(a);
    }
  }
  return { actions: kept, stripped };
}

/**
 * Mensaje humano para agregar al reply cuando se strippearon acciones de
 * edición. El cliente lo ve en chat para entender por qué no pasó nada.
 */
export function strippedEditMessage(stripped) {
  if (stripped.length === 0) return '';
  const types = new Set(stripped.map(a => a.type));
  if (types.has('delete_event')) {
    return 'No borré el evento porque no me pediste explícitamente borrarlo. Si querés, decime "borra X" o "elimina X".';
  }
  return 'No moví ni edité el evento existente porque no me pediste hacerlo. Si querés que lo cambie, decime "mueve X a las Y" o "cambia X".';
}
